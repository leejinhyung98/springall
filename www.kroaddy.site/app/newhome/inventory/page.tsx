"use client";

import Image from "next/image";
import { ArrowLeft, Home, MapPinned, Box, Sparkles, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

const badges = Array.from({ length: 72 }).map((_, index) => {
    // 모두 잠금 상태
    const unlocked = false;
    const tier = "locked";
    return { id: index, unlocked, tier };
});

export default function InventoryPage() {
    const router = useRouter();

    return (
        <div className="inventory-page flex flex-col h-screen bg-white">
            {/* 상단 네비게이션 바 */}
            <header className="flex items-center justify-between px-4 py-3 bg-[#1554a6] text-white shadow-md">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-sm font-semibold tracking-wide">Inventory (Collection)</h1>
                <div className="w-8 h-8 relative">
                    <Image
                        src="/img/logo2.png"
                        alt="Kroaddy logo"
                        fill
                        className="object-contain"
                    />
                </div>
            </header>

            {/* 컨텐츠 영역 */}
            <main className="flex-1 overflow-y-auto pb-24">
                {/* 티어 진행도 */}
                <section className="px-4 pt-4 pb-2 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-800">Next Tier: Silver (12/20)</p>
                        <div className="w-6 h-6 rounded-full bg-[#c67b3a] flex items-center justify-center text-white text-xs font-bold">
                            🥉
                        </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full w-[60%] bg-[#4ade80]" />
                    </div>
                </section>

                {/* 뱃지 그리드 (2x12 세 구역, 세로 구분선) */}
                <section className="px-8 pt-4 pb-10 bg-white mt-2">
                    <div className="flex">
                        {[0, 1, 2].map((groupIndex) => {
                            const start = groupIndex * 24; // 2x12 = 24개
                            const end = start + 24;
                            const groupBadges = badges.slice(start, end);
                            const titles = ["iconic spots", "iconic statues", "subways"];
                            const icons = ["/img/k1.png", "/img/k2.png", "/img/k3.png"];

                            return (
                                <div
                                    key={groupIndex}
                                    className={`flex-1 flex flex-col items-center border-gray-300 ${groupIndex < 2 ? "border-r" : ""}`}
                                >
                                    {/* 구역 헤더: 아이콘 + 텍스트 */}
                                    <div className="flex items-center justify-center gap-4 py-4">
                                        <div className="relative w-24 h-24">
                                            <Image
                                                src={icons[groupIndex]}
                                                alt={titles[groupIndex]}
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <span className="inventory-heading text-lg font-semibold uppercase tracking-wide text-gray-800">
                                            {titles[groupIndex]}
                                        </span>
                                    </div>

                                    {/* 잠금 아이콘 그리드 (첫 행 2개는 헤더로 사용하므로 제외) */}
                                    <div className="grid grid-cols-2 gap-y-8 justify-items-center w-full mt-2">
                                        {groupBadges.slice(2).map((badge) => (
                                            <div key={badge.id} className="flex flex-col items-center gap-1 py-1">
                                                <div className="w-16 h-16 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center shadow-md">
                                                    <span className="text-gray-400 text-lg">🔒</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* 하단 탭 바 */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1554a6] text-white flex items-center justify-around py-2 text-[10px]">
                <button className="flex flex-col items-center gap-1 opacity-80">
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                </button>
                <button className="flex flex-col items-center gap-1 opacity-80">
                    <MapPinned className="w-4 h-4" />
                    <span>Locations</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                    <Box className="w-4 h-4" />
                    <span className="font-semibold">Inventory</span>
                </button>
                <button className="flex flex-col items-center gap-1 opacity-80">
                    <Sparkles className="w-4 h-4" />
                    <span>Evons</span>
                </button>
                <button className="flex flex-col items-center gap-1 opacity-80">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                </button>
            </nav>
        </div>
    );
}


