"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import KakaoMap from "../../components/KakaoMap";
import { Message, Location, LanguageCode } from "../../lib/types";
import { t, getCurrentLanguage } from "../../lib/i18n";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RotateCcw, Info, HelpCircle, Navigation, User, BookOpen, Camera, Settings } from "lucide-react";

export type Screen = 'initial' | 'chatResponse' | 'placeDetail';

interface PlaceMenuProps {
    place: Location;
    onDetails: () => void;
    onQuiz: () => void;
    onDirections: () => void;
    onClose: () => void;
}

function PlaceMenu({ place, onDetails, onQuiz, onDirections, onClose }: PlaceMenuProps) {
    return (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4">
            {/* 장소 마커 아이콘 */}
            <div className="relative">
                <Image
                    src="/img/custom11.png"
                    alt="Place marker"
                    width={60}
                    height={60}
                    className="object-contain drop-shadow-lg"
                />
            </div>

            {/* 메뉴 버튼들 */}
            <div className="flex gap-3">
                <button
                    onClick={onDetails}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
                >
                    <Info className="w-5 h-5" />
                    <span>Details</span>
                </button>
                <button
                    onClick={onQuiz}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
                >
                    <HelpCircle className="w-5 h-5" />
                    <span>Quiz</span>
                </button>
                <button
                    onClick={onDirections}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
                >
                    <Navigation className="w-5 h-5" />
                    <span>Directions</span>
                </button>
            </div>
        </div>
    );
}

export default function NewHome() {
    const [screen, setScreen] = useState<Screen>('initial');
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<Location | null>(null);
    const [showPlaceMenu, setShowPlaceMenu] = useState(false);
    const [route, setRoute] = useState<Location[]>([]);
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [mapResetKey, setMapResetKey] = useState<number>(0);
    const [drawRouteKey, setDrawRouteKey] = useState<number>(0);
    const [uiLanguage, setUiLanguage] = useState<LanguageCode>(getCurrentLanguage());
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showChatBubble, setShowChatBubble] = useState(true);
    const [isChatbotExpanded, setIsChatbotExpanded] = useState(false);
    const [bubbleMessage, setBubbleMessage] = useState("안녕, 나는 로디야! 무엇을 도와줄까?");
    const router = useRouter();

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

    // 위치 업데이트 핸들러
    const handleLocationUpdate = useCallback((location: { lat: number; lng: number }) => {
        setCurrentLocation(location);
    }, []);

    const handlePlaceClick = (place: Location) => {
        setSelectedPlace(place);
        setShowPlaceMenu(true);
    };

    const handleDetails = () => {
        setShowPlaceMenu(false);
        // Details 로직 구현
        console.log('Details clicked for:', selectedPlace);
    };

    const handleQuiz = () => {
        setShowPlaceMenu(false);
        // Quiz 로직 구현
        console.log('Quiz clicked for:', selectedPlace);
    };

    const handleDirections = () => {
        setShowPlaceMenu(false);
        // Directions 로직 구현
        console.log('Directions clicked for:', selectedPlace);
    };

    const handleReset = () => {
        setMessages([]);
        setRoute([]);
        setSearchKeyword('');
        setSelectedPlace(null);
        setShowPlaceMenu(false);
        setScreen('initial');
        setShowChatBubble(true);
        setIsChatbotExpanded(false);
        setBubbleMessage("Hello! I'm your guide. Click a landmark icon to get started!");
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

    const handleSendMessage = (message: string) => {
        setIsChatbotExpanded(true);
        setShowChatBubble(false);

        const newMessages = [...messages, { role: 'user' as const, content: message }];
        setMessages(newMessages);
        setScreen('chatResponse');

        const typingMessage: Message = {
            role: 'assistant',
            content: t('chatbot.typing', uiLanguage)
        };
        setMessages([...newMessages, typingMessage]);

        setTimeout(() => {
            const responseContent = `I'm here to help you explore! Ask me about places, directions, or anything else.`;
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

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden relative">
            {/* 상단 바 */}
            <div className="absolute top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                {/* 로고 */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <Image
                            src="/img/logo2.png"
                            alt="Kroaddy logo"
                            width={40}
                            height={40}
                            className="object-contain"
                            priority
                        />
                    </div>
                    <span className="text-lg font-semibold text-gray-800">Kroaddy</span>
                </div>

                {/* Refresh 버튼 */}
                <button
                    onClick={handleReset}
                    className="w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg flex items-center justify-center transition-shadow"
                >
                    <RotateCcw className="w-5 h-5 text-gray-700" />
                </button>
            </div>

            {/* 지도 영역 - 전체 화면 */}
            <div className="flex-1 relative mt-14">
                <KakaoMap
                    route={route}
                    searchKeyword={searchKeyword}
                    onPlaceClick={handlePlaceClick}
                    resetKey={mapResetKey}
                    drawRouteKey={drawRouteKey}
                    onLocationUpdate={handleLocationUpdate}
                    onMapDrag={() => setShowPlaceMenu(false)}
                />

                {/* 장소 메뉴 (마커 클릭 시) */}
                {showPlaceMenu && selectedPlace && (
                    <PlaceMenu
                        place={selectedPlace}
                        onDetails={handleDetails}
                        onQuiz={handleQuiz}
                        onDirections={handleDirections}
                        onClose={() => setShowPlaceMenu(false)}
                    />
                )}

                {/* 챗봇 캐릭터 및 말풍선 - 오른쪽 하단 */}
                <div className="absolute bottom-32 right-6 z-50">
                    {!isChatbotExpanded ? (
                        <div className="relative flex items-end">
                            {/* 말풍선 - 챗봇 응답 출력창 */}
                            {showChatBubble && (
                                <div className="absolute bottom-full right-0 mb-2">
                                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-[500px] relative border-2 border-gray-800">
                                        <div className="absolute bottom-0 right-12 transform translate-y-full w-0 h-0 border-l-[16px] border-r-[16px] border-t-[16px] border-l-transparent border-r-transparent border-t-gray-800"></div>
                                        <p className="text-lg text-gray-900 leading-relaxed text-center font-medium break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                            {bubbleMessage}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* 챗봇 캐릭터 (펭귄) */}
                            <button
                                onClick={handleChatbotClick}
                                className="relative hover:scale-105 transition-transform cursor-pointer z-10"
                            >
                                <Image
                                    src="/img/character2.png"
                                    alt="Kroaddy penguin chatbot"
                                    width={140}
                                    height={140}
                                    className="object-contain"
                                    priority
                                />
                            </button>
                        </div>
                    ) : (
                        // 확장된 상태: 챗봇 UI
                        <div className="bg-white rounded-2xl shadow-2xl w-96 h-[600px] flex flex-col border border-gray-200">
                            {/* 헤더 */}
                            <div className="p-4 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden bg-blue-600">
                                        <Image
                                            src="/img/character2.png"
                                            alt="Kroaddy penguin"
                                            width={40}
                                            height={40}
                                            className="object-contain"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="text-gray-900 font-semibold">Kroaddy</h2>
                                        <p className="text-xs text-gray-500">AI Travel Assistant</p>
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
                                        <p>Hello! How can I help you?</p>
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
                                        placeholder="Type a message..."
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
            </div>

            {/* 하단 네비게이션 바 - menumenu.png 이미지 사용 */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full flex justify-center pointer-events-none">
                <div className="relative w-[700px] h-[140px] pointer-events-auto">
                    {/* 배경 이미지 */}
                    <Image
                        src="/img/menumenu.png"
                        alt="Bottom navigation"
                        fill
                        className="object-contain select-none"
                        priority
                    />

                    {/* 투명 클릭 영역만 오버레이 (5개 버튼) */}
                    <div className="absolute inset-0 flex items-center justify-between px-8">
                        <button
                            onClick={() => router.push('/mypage')}
                            className="flex-1 h-full opacity-0 hover:opacity-10 transition-opacity"
                            aria-label="My Page"
                        />
                        <button
                            onClick={() => router.push('/newhome/inventory')}
                            className="flex-1 h-full opacity-0 hover:opacity-10 transition-opacity"
                            aria-label="Inventory"
                        />
                        <button
                            className="flex-1 h-full opacity-0 hover:opacity-10 transition-opacity"
                            aria-label="Camera"
                        />
                        <button
                            className="flex-1 h-full opacity-0 hover:opacity-10 transition-opacity"
                            aria-label="Help"
                        />
                        <button
                            className="flex-1 h-full opacity-0 hover:opacity-10 transition-opacity"
                            aria-label="Settings"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
