'use client';

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Folder, Sparkles, Map } from "lucide-react";

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden hide-scrollbar"
      style={{
        backgroundImage: 'url(/hanoks/hanok4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none z-0"></div>

      {/* 배경 애니메이션 요소들 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="floating-circle floating-circle-1"></div>
        <div className="floating-circle floating-circle-2"></div>
        <div className="floating-circle floating-circle-3"></div>
      </div>

      {/* 포트폴리오 버튼 */}
      <Link
        href="/portfolio"
        className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white hover:shadow-xl transition-all duration-300 text-gray-900 font-medium hover:scale-105"
      >
        <Folder className="w-5 h-5" />
        <span>포트폴리오</span>
      </Link>

      {/* 이미지 생성 버튼 */}
      <Link
        href="/imagemk"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-white font-medium hover:scale-105"
      >
        <Sparkles className="w-5 h-5" />
        <span>이미지 생성</span>
      </Link>

      {/* New Home 버튼 */}
      <Link
        href="/newhome"
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white hover:shadow-xl transition-all duration-300 text-gray-900 font-medium hover:scale-105"
      >
        <Map className="w-5 h-5" />
        <span>New Home</span>
      </Link>

      {/* 로고 */}
      <div className="mb-12 sm:mb-16 md:mb-20 opacity-0 animate-fade-in-up relative z-10">
        <div className="relative logo-container">
          <div className="absolute inset-0 animate-pulse-slow blur-3xl opacity-20 bg-gradient-to-r from-red-400 via-blue-400 to-red-400"></div>
          <Image
            src="/img/logo3.png"
            alt="Kroaddy"
            width={400}
            height={400}
            priority
            className="w-48 sm:w-56 md:w-64 lg:w-72 xl:w-80 relative animate-float logo-shadow"
          />
        </div>
      </div>

      {/* 타이틀 */}
      <div className="mb-8 sm:mb-10 md:mb-12 px-4 opacity-0 animate-fade-in-up animation-delay-200 relative z-10">
        <div className="title-wrapper relative inline-block animate-float-subtle">
          <h1
            className="antialiased relative cursor-default transition-all duration-500 drop-shadow-lg"
            style={{
              fontWeight: 700,
              fontSize: 'clamp(3.5rem, 10vw, 6rem)',
              color: '#ffffff',
              textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 0, 0, 0.3)',
              letterSpacing: '-0.03em',
              lineHeight: '1.2'
            }}
          >
            <span className="inline-block">
              {/* K */}
              <span
                className="inline-block transition-all duration-500"
                style={{ color: isHovered ? '#dc2626' : '#ffffff' }}
              >
                K
              </span>

              {/* 점 1 */}
              <span
                className="inline-block transition-all duration-400"
                style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'scale(1)' : 'scale(0)',
                  width: isHovered ? 'auto' : '0',
                  margin: isHovered ? '0 0.3em' : '0',
                  color: '#d1d5db'
                }}
              >
                •
              </span>

              {/* r */}
              <span
                className="inline-block transition-all duration-500"
                style={{ color: isHovered ? '#dc2626' : '#ffffff' }}
              >
                r
              </span>

              {/* o */}
              <span
                className="inline-block transition-all duration-500"
                style={{ color: isHovered ? '#2563eb' : '#ffffff' }}
              >
                o
              </span>

              {/* a */}
              <span
                className="inline-block transition-all duration-500"
                style={{ color: isHovered ? '#2563eb' : '#ffffff' }}
              >
                a
              </span>

              {/* d */}
              <span
                className="inline-block transition-all duration-500"
                style={{ color: isHovered ? '#dc2626' : '#ffffff' }}
              >
                d
              </span>

              {/* 점 2 */}
              <span
                className="inline-block transition-all duration-400"
                style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'scale(1)' : 'scale(0)',
                  width: isHovered ? 'auto' : '0',
                  margin: isHovered ? '0 0.3em' : '0',
                  color: '#d1d5db'
                }}
              >
                •
              </span>

              {/* d->b 변환 (6번째 글자, 좌우반전) */}
              <span
                className="inline-block transition-all duration-700"
                style={{
                  color: isHovered ? '#2563eb' : '#ffffff',
                  display: 'inline-block'
                }}
              >
                {isHovered ? 'b' : 'd'}
              </span>

              {/* y */}
              <span
                className="inline-block transition-all duration-500"
                style={{ color: isHovered ? '#dc2626' : '#ffffff' }}
              >
                y
              </span>
            </span>
          </h1>
        </div>
      </div>

      {/* 시작하기 링크 */}
      <div className="mt-16 sm:mt-20 md:mt-24 lg:mt-32 animate-fade-in-up animation-delay-400 relative z-10 animate-float-link">
        <Link
          href="/login"
          className="text-link group inline-flex items-center gap-2 sm:gap-3 transition-all duration-500"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span className="link-text font-semibold text-lg sm:text-xl text-white drop-shadow-md" style={{ textShadow: '1px 1px 4px rgba(0, 0, 0, 0.5)' }}>지금 시작하기</span>
          <span className="link-arrow text-xl sm:text-2xl text-white drop-shadow-md" style={{ textShadow: '1px 1px 4px rgba(0, 0, 0, 0.5)' }}>→</span>
        </Link>
      </div>
    </main>
  );
}