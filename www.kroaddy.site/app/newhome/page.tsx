"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import KakaoMap from "../../components/KakaoMap";
import { WeatherWidget } from "../../components/WeatherWidget";
import { PlacePopup } from "../../components/PlacePopup";
import { Message, Location, LanguageCode } from "../../lib/types";
import { keywordPlaceMap } from "../../lib/keywordPlaces";
import { t, getCurrentLanguage } from "../../lib/i18n";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Home, User, HeadphonesIcon, Bell, MapPin, Settings, Languages, AlertTriangle } from "lucide-react";

export type Screen = 'initial' | 'chatResponse' | 'placeDetail';

export default function NewHome() {
    const [screen, setScreen] = useState<Screen>('initial');
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Location | null>(null);
    const [route, setRoute] = useState<Location[]>([]);
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [showChatbot, setShowChatbot] = useState(true);
    const [mapResetKey, setMapResetKey] = useState<number>(0);
    const [drawRouteKey, setDrawRouteKey] = useState<number>(0);
    const [uiLanguage, setUiLanguage] = useState<LanguageCode>(getCurrentLanguage());
    const abortControllerRef = useRef<AbortController | null>(null);
    const timeoutRefsRef = useRef<NodeJS.Timeout[]>([]);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [weatherInfo, setWeatherInfo] = useState<{ temp: number; description: string; city: string } | null>(null);
    const [showChatBubble, setShowChatBubble] = useState(true);
    const [isChatbotExpanded, setIsChatbotExpanded] = useState(false);
    const [bubbleMessage, setBubbleMessage] = useState("안녕하세요~ 저는 로디에요! 궁금한 점이 있으시면 언제든 호출해주세요");
    const [inputValue, setInputValue] = useState("");

    // 언어 변경 감지
    useEffect(() => {
        const handleLanguageChange = () => {
            setUiLanguage(getCurrentLanguage());
        };

        window.addEventListener('languageChanged', handleLanguageChange as EventListener);
        return () => {
            window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
        };
    }, []);

    // 위치 및 날씨 정보 업데이트 핸들러
    const handleLocationUpdate = useCallback((location: { lat: number; lng: number }) => {
        setCurrentLocation(location);
        console.log('위치 정보 업데이트:', location);
    }, []);

    const handleWeatherUpdate = useCallback((weather: { temp: number; description: string; city: string }) => {
        setWeatherInfo(weather);
        console.log('날씨 정보 업데이트:', weather);
    }, []);

    // cleanup: 컴포넌트 언마운트 시 타임아웃 및 AbortController 정리
    useEffect(() => {
        return () => {
            // 모든 타임아웃 정리
            timeoutRefsRef.current.forEach(timeout => clearTimeout(timeout));
            timeoutRefsRef.current = [];

            // 진행 중인 요청 취소
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    const handleSendMessage = (message: string) => {
        // 챗봇 확장
        setIsChatbotExpanded(true);
        setShowChatBubble(false);

        const newMessages = [...messages, { role: 'user' as const, content: message }];
        setMessages(newMessages);
        setScreen('chatResponse');

        // 기존 home 페이지의 handleSendMessage 로직을 간소화하여 사용
        // 여기서는 기본적인 응답만 처리
        const typingMessage: Message = {
            role: 'assistant',
            content: t('chatbot.typing', uiLanguage)
        };
        setMessages([...newMessages, typingMessage]);

        // 간단한 응답 처리
        setTimeout(() => {
            const responseContent = `"${message}"에 대한 정보를 찾고 있습니다. 더 자세한 기능은 기존 home 페이지를 참고해주세요.`;
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === typingMessage.content) {
                    return [...prev.slice(0, -1), {
                        role: 'assistant',
                        content: responseContent
                    }];
                }
                return [...prev, {
                    role: 'assistant',
                    content: responseContent
                }];
            });
        }, 2000);
    };

    const handlePlaceClick = (place: Location) => {
        setSelectedPlace(place);
        if (screen === 'initial') {
            setScreen('chatResponse');
        }
    };

    const handleReset = () => {
        setMessages([]);
        setRoute([]);
        setSearchKeyword('');
        setSelectedPlace(null);
        setScreen('initial');
        setShowChatbot(true);
        setShowChatBubble(true);
        setIsChatbotExpanded(false);
        setBubbleMessage("안녕하세요~ 저는 로디에요! 궁금한 점이 있으시면 언제든 호출해주세요");
        setInputValue("");
        setMapResetKey(prev => prev + 1);
        setDrawRouteKey(0);
    };

    const handleChatbotClick = () => {
        if (!isChatbotExpanded) {
            setIsChatbotExpanded(true);
            setShowChatBubble(false);
        }
    };

    const handleCloseChatbot = () => {
        setIsChatbotExpanded(false);
        setShowChatBubble(true);
    };

    // 말풍선 응답 생성 함수
    const generateBubbleResponse = (message: string): string => {
        const lowerMessage = message.toLowerCase().trim();

        // 인사말 처리
        if (lowerMessage.includes('안녕') || lowerMessage.includes('안뇽') || lowerMessage.includes('하이') || lowerMessage.includes('hi')) {
            return "반가워요~ 무엇을 도와드릴까요?";
        }

        // 로디/로디야 호출
        if (lowerMessage.includes('로디') || lowerMessage.includes('roaddy')) {
            if (lowerMessage.includes('안녕')) {
                return "반가워요~ 무엇을 도와드릴까요?";
            }
            return "네, 무엇을 도와드릴까요?";
        }

        // 기본 응답
        return "무엇을 도와드릴까요? 맛집, 관광지, 장소 등을 물어보세요!";
    };

    const handleBubbleInput = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            const response = generateBubbleResponse(inputValue);
            setBubbleMessage(response);
            setInputValue("");
        }
    };

    const router = useRouter();

    return (
        <div className="flex h-screen bg-white overflow-hidden relative">
            {/* 사이드바 - 다크 그레이 배경 */}
            <div className="w-20 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-6">
                {/* 로고 */}
                <div className="mb-8">
                    <button
                        onClick={handleReset}
                        className="flex flex-col items-center hover:opacity-70 transition-opacity cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex items-center justify-center mb-1">
                            <Image
                                src="/img/logo2.png"
                                alt="Kroaddy logo"
                                width={48}
                                height={48}
                                className="object-contain"
                                priority
                            />
                        </div>
                        <span className="text-[10px] text-gray-300">roaddy</span>
                    </button>
                </div>

                {/* 메뉴 아이템 */}
                <div className="flex-1 flex flex-col gap-6">
                    <button
                        onClick={() => setShowChatbot(!showChatbot)}
                        className={`flex flex-col items-center gap-1 hover:opacity-70 transition-opacity ${showChatbot ? 'opacity-100' : 'opacity-50'
                            }`}
                    >
                        <Search className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">검색</span>
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                        <Home className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">홈</span>
                    </button>

                    <button
                        onClick={() => router.push('/mypage')}
                        className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                        <User className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">마이페이지</span>
                    </button>

                    <button
                        onClick={() => router.push('/support')}
                        className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                        <HeadphonesIcon className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">지원</span>
                    </button>

                    <button className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity">
                        <Bell className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">알림</span>
                    </button>

                    <button className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity">
                        <MapPin className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">위치</span>
                    </button>

                    <button className="flex flex-col items-center gap-1 hover:opacity-70 transition-opacity">
                        <Settings className="w-5 h-5 text-gray-300" />
                        <span className="text-[9px] text-gray-300">설정</span>
                    </button>
                </div>

                {/* 응급사항 버튼 */}
                <button className="mt-auto px-3 py-3 bg-red-500 text-white rounded-xl hover:opacity-90 transition-opacity flex flex-col items-center gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-[9px]">경고해제</span>
                </button>
            </div>

            {/* 지도 영역 - 전체 차지 */}
            <div className="flex-1 relative">
                <KakaoMap
                    route={route}
                    searchKeyword={searchKeyword}
                    onPlaceClick={handlePlaceClick}
                    resetKey={mapResetKey}
                    drawRouteKey={drawRouteKey}
                    onLocationUpdate={handleLocationUpdate}
                />

                {/* 날씨 위젯 - 오른쪽 상단 */}
                <div className="absolute top-4 right-4 z-50">
                    <WeatherWidget
                        onWeatherUpdate={handleWeatherUpdate}
                        onLocationUpdate={handleLocationUpdate}
                    />
                </div>

                {/* 장소 정보 팝업 - 왼쪽 상단 */}
                {selectedPlace && (
                    <div className="absolute top-4 left-24 z-50 w-96 max-h-[80vh] overflow-hidden">
                        <PlacePopup
                            place={selectedPlace}
                            onClose={() => {
                                setSelectedPlace(null);
                            }}
                        />
                    </div>
                )}

                {/* 챗봇 캐릭터 및 말풍선 - 오른쪽 하단 */}
                {showChatbot && (
                    <div className="absolute bottom-6 right-6 z-50">
                        {!isChatbotExpanded ? (
                            // 초기 상태: 입력창, 캐릭터와 말풍선
                            <div className="flex items-end gap-3">
                                {/* 입력창 - 캐릭터 왼쪽 */}
                                <form
                                    onSubmit={handleBubbleInput}
                                    className="flex flex-col gap-2"
                                >
                                    <div className="bg-white rounded-xl shadow-lg p-3 flex items-center gap-2 min-w-[200px]">
                                        <input
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder="메시지를 입력하세요..."
                                            className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="submit"
                                            className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </button>
                                    </div>
                                </form>

                                {/* 말풍선과 캐릭터 */}
                                <div className="flex flex-col items-end gap-3">
                                    {/* 말풍선 */}
                                    {showChatBubble && (
                                        <div className="bg-white rounded-2xl shadow-xl p-4 max-w-xs relative animate-fade-in">
                                            <div className="absolute bottom-0 right-8 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-white"></div>
                                            <p className="text-sm text-gray-800 leading-relaxed">
                                                {bubbleMessage}
                                            </p>
                                        </div>
                                    )}

                                    {/* 챗봇 캐릭터 */}
                                    <button
                                        onClick={handleChatbotClick}
                                        className="relative hover:scale-105 transition-transform cursor-pointer"
                                    >
                                        <Image
                                            src="/img/roaddy2.png"
                                            alt="Roaddy chatbot"
                                            width={120}
                                            height={120}
                                            className="object-contain"
                                            priority
                                        />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // 확장된 상태: 챗봇 UI
                            <div className="bg-white rounded-2xl shadow-2xl w-96 h-[600px] flex flex-col border border-gray-200">
                                {/* 헤더 */}
                                <div className="p-4 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden bg-blue-600">
                                            <span className="text-white relative z-10">R</span>
                                        </div>
                                        <div>
                                            <h2 className="text-gray-900 font-semibold">Roaddy</h2>
                                            <p className="text-xs text-gray-500">AI 여행 어시스턴트</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseChatbot}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* 메시지 영역 */}
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-gray-400 mt-20">
                                            <p>안녕하세요! 무엇을 도와드릴까요?</p>
                                        </div>
                                    ) : (
                                        messages.map((message, index) => (
                                            <div
                                                key={index}
                                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-100 text-gray-900'
                                                        }`}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* 입력 영역 */}
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const input = (e.target as HTMLFormElement).querySelector('input')?.value;
                                        if (input) {
                                            handleSendMessage(input);
                                            (e.target as HTMLFormElement).querySelector('input')!.value = '';
                                        }
                                    }}
                                    className="p-4 border-t"
                                >
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="메시지를 입력하세요..."
                                            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

