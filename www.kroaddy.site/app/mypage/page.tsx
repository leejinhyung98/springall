'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Home, MessageSquare, MapPin, User, LogOut, Settings, FileText, Heart, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { useLogout } from '@/store/authStore';
import { t, getCurrentLanguage } from '@/lib/i18n';
import { LanguageCode } from '@/lib/types';

export default function MyPage() {
    const router = useRouter();
    const [activeMenu, setActiveMenu] = useState('mypage');
    const [activeRightMenu, setActiveRightMenu] = useState<string | null>(null);
    const logout = useLogout();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [uiLanguage, setUiLanguage] = useState<LanguageCode>(getCurrentLanguage());
    const [isAuthenticated, setIsAuthenticated] = useState(false);

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

    // 인증 상태 확인
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const authStatus = localStorage.getItem('authStatus');
            if (authStatus === 'completed') {
                setIsAuthenticated(true);
            }
        }
    }, []);

    // 댓글 단 글 목록 (예시 데이터)
    const comments = [
        {
            id: 1,
            timestamp: '08/10 03:23',
            content: 'Lorem Ipsum',
            place: 'Gyeongbokgung Palace',
            postId: 'Post 230',
            ageRange: '29 - 40s'
        },
        {
            id: 2,
            timestamp: '08/09 14:15',
            content: 'Lorem Ipsum',
            place: 'Namsan Tower',
            postId: 'Post 189',
            ageRange: '29 - 40s'
        },
        {
            id: 3,
            timestamp: '08/08 09:42',
            content: 'Lorem Ipsum',
            place: 'Myeongdong',
            postId: 'Post 156',
            ageRange: '29 - 40s'
        }
    ];

    const menuItems = [
        { id: 'home', labelKey: 'mypage.home', icon: Home },
        { id: 'reviews', labelKey: 'mypage.travelReviews', icon: MessageSquare },
        { id: 'status', labelKey: 'mypage.travelStatus', icon: MapPin },
        { id: 'mypage', labelKey: 'mypage.myPage', icon: User }
    ];

    const handleLogout = async () => {
        if (isLoggingOut) return; // 중복 클릭 방지

        // 확인 다이얼로그
        if (!confirm(t('mypage.logoutConfirm', uiLanguage))) {
            return;
        }

        setIsLoggingOut(true);

        try {
            // 백엔드 로그아웃 API 호출 (쿠키 삭제)
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include', // 쿠키 포함
            });
        } catch (error) {
            console.error('로그아웃 API 호출 실패:', error);
            // API 호출 실패해도 로컬 상태는 정리
        }

        // 로컬 스토리지 정리
        if (typeof window !== 'undefined') {
            localStorage.clear();
        }

        // Zustand 스토어에서 인증 상태 제거
        logout();

        // 메인 페이지로 리다이렉트
        router.push('/');
    };

    return (
        <div className="flex h-screen relative overflow-hidden">
            {/* 배경 애니메이션 요소들 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="floating-circle floating-circle-1"></div>
                <div className="floating-circle floating-circle-2"></div>
                <div className="floating-circle floating-circle-3"></div>
            </div>

            {/* 왼쪽 사이드바 */}
            <div className="w-64 bg-white/80 backdrop-blur-md border-r border-gray-200/50 flex flex-col relative z-10 shadow-lg">
                {/* 로고 */}
                <div className="p-6">
                    <div className="bg-gradient-to-r from-red-50 to-blue-50 rounded-lg px-4 py-2 inline-block border border-gray-200/50 shadow-sm">
                        <span className="text-2xl font-bold text-black">Kroaddy</span>
                    </div>
                </div>

                {/* 네비게이션 메뉴 */}
                <nav className="flex-1 px-4">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeMenu === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveMenu(item.id);
                                    // 홈 버튼 클릭 시 /home으로 이동
                                    if (item.id === 'home') {
                                        router.push('/home');
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all duration-300 ${isActive
                                    ? 'bg-black text-white shadow-md'
                                    : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium">{t(item.labelKey, uiLanguage)}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* 로그아웃 */}
                <div className="p-4 border-t border-gray-200/50">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100/80 rounded-lg transition-all duration-300 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">{isLoggingOut ? t('mypage.loggingOut', uiLanguage) : t('mypage.logout', uiLanguage)}</span>
                        <ChevronRight className="w-4 h-4 ml-auto" />
                    </button>
                </div>
            </div>

            {/* 중앙 메인 콘텐츠 */}
            <div className="flex-1 overflow-auto relative z-10">
                <div className="max-w-4xl mx-auto p-8">
                    {activeMenu === 'status' ? (
                        /* 여행현황 페이지 */
                        <>
                            <h1 className="text-3xl font-bold text-gray-900 mb-8 opacity-0 animate-fade-in-up">{t('mypage.travelStatus', uiLanguage)}</h1>

                            {/* 현재 진행 중인 여행 */}
                            <div className="mb-8">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('mypage.currentTravel', uiLanguage)}</h2>
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50">
                                    <p className="text-gray-500 text-center py-8">{t('mypage.noCurrentTravel', uiLanguage)}</p>
                                </div>
                            </div>

                            {/* 예정된 여행 */}
                            <div className="mb-8">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('mypage.upcomingTravel', uiLanguage)}</h2>
                                <div className="space-y-4">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">서울 여행</h3>
                                            <span className="text-sm text-gray-500">2024.12.25 - 2024.12.27</span>
                                        </div>
                                        <p className="text-gray-600 mb-4">경복궁, 남산타워, 명동을 방문하는 3일 일정</p>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">3개 장소</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 완료된 여행 */}
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('mypage.completedTravel', uiLanguage)}</h2>
                                <div className="space-y-4">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">부산 여행</h3>
                                            <span className="text-sm text-gray-500">2024.11.15 - 2024.11.17</span>
                                        </div>
                                        <p className="text-gray-600 mb-4">해운대, 감천문화마을, 자갈치시장을 방문한 3일 일정</p>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">5개 장소</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeMenu === 'reviews' ? (
                        /* 여행후기 페이지 */
                        <>
                            <h1 className="text-3xl font-bold text-gray-900 mb-8 opacity-0 animate-fade-in-up">{t('mypage.travelReviews', uiLanguage)}</h1>

                            {/* 여행후기 목록 */}
                            <div className="space-y-4">
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">서울 3일 여행 후기</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                                <span>2024.12.25 - 2024.12.27</span>
                                                <span>•</span>
                                                <span>경복궁, 남산타워, 명동</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400">2024.12.28</span>
                                    </div>
                                    <p className="text-gray-700 mb-4 leading-relaxed">
                                        서울 여행이 정말 즐거웠습니다. 경복궁의 역사적인 분위기와 남산타워에서 본 야경이 특히 인상적이었어요.
                                        명동에서 쇼핑도 즐기고 맛있는 음식도 많이 먹었습니다. 다음에 또 방문하고 싶은 곳이에요!
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                            <span className="text-sm text-gray-600">24</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MessageSquare className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">8</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">부산 해운대 여행 후기</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                                <span>2024.11.15 - 2024.11.17</span>
                                                <span>•</span>
                                                <span>해운대, 감천문화마을, 자갈치시장</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400">2024.11.18</span>
                                    </div>
                                    <p className="text-gray-700 mb-4 leading-relaxed">
                                        부산의 바다와 문화를 모두 즐길 수 있는 여행이었습니다. 해운대의 아름다운 해변과 감천문화마을의
                                        다채로운 벽화가 정말 멋졌어요. 자갈치시장에서 신선한 해산물도 맛보고, 부산의 특별한 매력을 느낄 수 있었습니다.
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                            <span className="text-sm text-gray-600">31</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MessageSquare className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">12</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">제주도 여행 후기</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                                <span>2024.10.01 - 2024.10.04</span>
                                                <span>•</span>
                                                <span>성산일출봉, 한라산, 섭지코지</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400">2024.10.05</span>
                                    </div>
                                    <p className="text-gray-700 mb-4 leading-relaxed">
                                        제주도의 자연이 주는 평화로움이 정말 좋았습니다. 성산일출봉에서 본 일출은 평생 잊지 못할 장면이었고,
                                        한라산 등반도 도전적이면서도 보람찬 경험이었어요. 섭지코지의 푸른 바다도 너무 아름다웠습니다.
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                            <span className="text-sm text-gray-600">45</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MessageSquare className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">18</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeMenu === 'mypage' ? (
                        /* 마이페이지 */
                        <>
                            <h1 className="text-3xl font-bold text-gray-900 mb-8 opacity-0 animate-fade-in-up">{t('mypage.myPage', uiLanguage)}</h1>

                            {/* 통계 카드 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-500">{t('mypage.totalTravels', uiLanguage)}</span>
                                        <MapPin className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">12</p>
                                </div>
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-500">{t('mypage.totalReviews', uiLanguage)}</span>
                                        <MessageSquare className="w-5 h-5 text-green-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">8</p>
                                </div>
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-500">{t('mypage.totalComments', uiLanguage)}</span>
                                        <FileText className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">24</p>
                                </div>
                            </div>

                            {/* 최근 활동 */}
                            <div className="mb-8">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('mypage.recentActivity', uiLanguage)}</h2>
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{t('mypage.activityReview', uiLanguage)}</p>
                                                <p className="text-xs text-gray-500">서울 3일 여행 후기 • 2일 전</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{t('mypage.activityComment', uiLanguage)}</p>
                                                <p className="text-xs text-gray-500">경복궁 게시글에 댓글 작성 • 3일 전</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                                <MapPin className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{t('mypage.activityTravel', uiLanguage)}</p>
                                                <p className="text-xs text-gray-500">부산 여행 계획 완료 • 5일 전</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                                <Heart className="w-5 h-5 text-yellow-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{t('mypage.activityLike', uiLanguage)}</p>
                                                <p className="text-xs text-gray-500">제주도 여행 후기에 좋아요 • 1주 전</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 빠른 액션 */}
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('mypage.quickActions', uiLanguage)}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300 text-left">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <MapPin className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900">{t('mypage.createTravel', uiLanguage)}</h3>
                                        </div>
                                        <p className="text-sm text-gray-600">{t('mypage.createTravelDesc', uiLanguage)}</p>
                                    </button>
                                    <button className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300 text-left">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                                <MessageSquare className="w-5 h-5 text-green-600" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900">{t('mypage.writeReview', uiLanguage)}</h3>
                                        </div>
                                        <p className="text-sm text-gray-600">{t('mypage.writeReviewDesc', uiLanguage)}</p>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* 댓글 단 글 페이지 */
                        <>
                            <h1 className="text-3xl font-bold text-gray-900 mb-8 opacity-0 animate-fade-in-up">{t('mypage.commentsWritten', uiLanguage)}</h1>

                            {/* 댓글 목록 */}
                            <div className="space-y-4">
                                {comments.map((comment, index) => (
                                    <div
                                        key={comment.id}
                                        className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 hover:shadow-lg transition-all duration-300 border border-gray-200/50 opacity-0 animate-fade-in-up"
                                        style={{ animationDelay: `${(index + 1) * 0.1}s` }}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <span className="text-sm text-gray-500">{comment.timestamp}</span>
                                        </div>

                                        <p className="text-gray-800 mb-4">{comment.content}</p>

                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-lg p-4 flex items-center justify-between border border-gray-200/50">
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold text-gray-900">{comment.place}</span>
                                                <span className="text-sm text-gray-600">{comment.postId}</span>
                                                <span className="text-sm text-gray-600">{comment.ageRange}</span>
                                            </div>
                                            <button
                                                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-300 text-sm font-medium shadow-sm hover:shadow-md relative overflow-hidden"
                                                style={{
                                                    backgroundImage: 'url(/hanoks/danchung.jpg)',
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-black/20"></div>
                                                <span className="relative z-10">{t('mypage.confirm', uiLanguage)}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 오른쪽 사이드바 */}
            <div className="w-80 bg-white/80 backdrop-blur-md border-l border-gray-200/50 p-6 relative z-10 shadow-lg">
                {/* 사용자 프로필 */}
                <div className="text-center mb-8 opacity-0 animate-fade-in-up animation-delay-200">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-gray-200/50 shadow-sm">
                        <User className="w-10 h-10 text-gray-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">pjjw1233@gmail.com</h2>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${isAuthenticated
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200/50'
                        : 'bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 border-yellow-200/50'
                        }`}>
                        {isAuthenticated ? t('mypage.authComplete', uiLanguage) : t('mypage.authIncomplete', uiLanguage)}
                    </span>
                </div>

                {/* 계정 섹션 */}
                <div className="mb-8 opacity-0 animate-fade-in-up animation-delay-300">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">{t('mypage.account', uiLanguage)}</h3>
                    <div className="space-y-2">
                        <button
                            onClick={() => {
                                setActiveRightMenu('manageInfo');
                                router.push('/mypage/profile');
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${activeRightMenu === 'manageInfo'
                                ? 'bg-black text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-100/80 border border-transparent hover:border-gray-200/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Settings className={`w-5 h-5 ${activeRightMenu === 'manageInfo' ? 'text-white' : 'text-gray-400'}`} />
                                <span>{t('mypage.manageInfo', uiLanguage)}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${activeRightMenu === 'manageInfo' ? 'text-white' : 'text-gray-400'}`} />
                        </button>
                        <button
                            onClick={() => {
                                setActiveRightMenu('authentication');
                                // 인증 완료 처리
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('authStatus', 'completed');
                                    setIsAuthenticated(true);
                                }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${activeRightMenu === 'authentication'
                                ? 'bg-black text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-100/80 border border-transparent hover:border-gray-200/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <User className={`w-5 h-5 ${activeRightMenu === 'authentication' ? 'text-white' : 'text-gray-400'}`} />
                                <span>{t('mypage.authentication', uiLanguage)}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${activeRightMenu === 'authentication' ? 'text-white' : 'text-gray-400'}`} />
                        </button>
                    </div>
                </div>

                {/* 글 관리 섹션 */}
                <div className="opacity-0 animate-fade-in-up animation-delay-400">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">{t('mypage.postManagement', uiLanguage)}</h3>
                    <div className="space-y-2">
                        <button
                            onClick={() => setActiveRightMenu('myPosts')}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${activeRightMenu === 'myPosts'
                                ? 'bg-black text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-100/80 border border-transparent hover:border-gray-200/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <FileText className={`w-5 h-5 ${activeRightMenu === 'myPosts' ? 'text-white' : 'text-gray-400'}`} />
                                <span>{t('mypage.myPosts', uiLanguage)}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${activeRightMenu === 'myPosts' ? 'text-white' : 'text-gray-400'}`} />
                        </button>
                        <button
                            onClick={() => setActiveRightMenu('commentsWritten')}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${activeRightMenu === 'commentsWritten'
                                ? 'bg-black text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-100/80 border border-transparent hover:border-gray-200/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <MessageSquare className={`w-5 h-5 ${activeRightMenu === 'commentsWritten' ? 'text-white' : 'text-gray-400'}`} />
                                <span className={activeRightMenu === 'commentsWritten' ? 'font-medium' : ''}>{t('mypage.commentsWritten', uiLanguage)}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${activeRightMenu === 'commentsWritten' ? 'text-white' : 'text-gray-400'}`} />
                        </button>
                        <button
                            onClick={() => setActiveRightMenu('likedPosts')}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${activeRightMenu === 'likedPosts'
                                ? 'bg-black text-white shadow-md'
                                : 'text-gray-700 hover:bg-gray-100/80 border border-transparent hover:border-gray-200/50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Heart className={`w-5 h-5 ${activeRightMenu === 'likedPosts' ? 'text-white' : 'text-gray-400'}`} />
                                <span>{t('mypage.likedPosts', uiLanguage)}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${activeRightMenu === 'likedPosts' ? 'text-white' : 'text-gray-400'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

