// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { X, Info, MessageCircle, BookOpen, AlertTriangle, Star, DollarSign } from 'lucide-react';
import { Location, LanguageCode, PlaceWithMenu } from '../lib/types';
import { ImageWithFallback } from './ImageWithFallback';
import { getCurrentLanguage, t } from '../lib/i18n';
import { translateText, detectLanguage } from '../service/translateService';
import { fetchPlacesWithPrices } from '../lib/crawlerApi';

interface PlacePopupProps {
  place: Location;
  onClose: () => void;
}

type TabType = 'info' | 'phrases' | 'story' | 'tips' | 'reviews' | 'pricing';

export function PlacePopup({ place, onClose }: PlacePopupProps) {
  const [uiLanguage, setUiLanguage] = useState<LanguageCode>(getCurrentLanguage());
  const [translatedName, setTranslatedName] = useState<string>(place.name);
  const [translatedCategory, setTranslatedCategory] = useState<string>(place.category || '');
  const [translatedAddress, setTranslatedAddress] = useState<string>(place.address || '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [priceInfo, setPriceInfo] = useState<PlaceWithMenu | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

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

  // 장소명, 카테고리, 주소 번역
  useEffect(() => {
    const translatePlaceInfo = async () => {
      // 한국어가 아니거나 번역이 필요한 경우에만 번역
      if (uiLanguage === 'ko') {
        setTranslatedName(place.name);
        setTranslatedCategory(place.category || '');
        setTranslatedAddress(place.address || '');
        return;
      }

      setIsTranslating(true);
      try {
        // 장소명 번역 (한국어 장소명은 보통 'ko'로 감지됨)
        if (place.name) {
          try {
            const sourceLang = await detectLanguage(place.name);
            if (sourceLang !== uiLanguage) {
              const translated = await translateText(place.name, sourceLang, uiLanguage);
              setTranslatedName(translated);
            } else {
              setTranslatedName(place.name);
            }
          } catch (error) {
            console.warn('장소명 번역 실패:', error);
            setTranslatedName(place.name);
          }
        }

        // 카테고리 번역
        if (place.category) {
          try {
            const sourceLang = await detectLanguage(place.category);
            if (sourceLang !== uiLanguage) {
              const translated = await translateText(place.category, sourceLang, uiLanguage);
              setTranslatedCategory(translated);
            } else {
              setTranslatedCategory(place.category);
            }
          } catch (error) {
            console.warn('카테고리 번역 실패:', error);
            setTranslatedCategory(place.category);
          }
        }

        // 주소는 일반적으로 번역하지 않지만, 필요시 번역 가능
        // 주소는 그대로 표시하는 것이 일반적
        setTranslatedAddress(place.address || '');
      } catch (error) {
        console.error('번역 중 에러:', error);
        setTranslatedName(place.name);
        setTranslatedCategory(place.category || '');
        setTranslatedAddress(place.address || '');
      } finally {
        setIsTranslating(false);
      }
    };

    translatePlaceInfo();
  }, [place.name, place.category, place.address, uiLanguage]);

  const tabs = [
    { id: 'info' as TabType, icon: Info, labelKey: 'placepopup.tab.info', color: 'from-[#0088FF] to-[#0088FF]/80' },
    { id: 'phrases' as TabType, icon: MessageCircle, labelKey: 'placepopup.tab.phrases', color: 'from-[#FF383C] to-[#FF383C]/80' },
    { id: 'story' as TabType, icon: BookOpen, labelKey: 'placepopup.tab.story', color: 'from-[#0088FF] to-[#0088FF]/80' },
    { id: 'tips' as TabType, icon: AlertTriangle, labelKey: 'placepopup.tab.tips', color: 'from-[#FF383C] to-[#FF383C]/80' },
    { id: 'reviews' as TabType, icon: Star, labelKey: 'placepopup.tab.reviews', color: 'from-[#0088FF] to-[#0088FF]/80' },
    { id: 'pricing' as TabType, icon: DollarSign, labelKey: 'placepopup.tab.pricing', color: 'from-[#FF383C] to-[#FF383C]/80' }
  ];

  // Pricing 탭 클릭 시 가격 정보 조회
  const handleTabClick = async (tabId: TabType) => {
    setActiveTab(tabId);

    if (tabId === 'pricing') {
      setIsLoadingPrice(true);
      setPriceError(null);
      setPriceInfo(null);

      try {
        // 주변 장소 조회 (500m 반경으로 좁게 설정하여 정확한 매칭)
        const places = await fetchPlacesWithPrices(place.lat, place.lng, 500);

        // 장소 이름과 좌표로 매칭 (이름이 정확히 일치하거나 포함되는 경우)
        const matchedPlace = places.find(p => {
          const nameMatch = p.name === place.name ||
            p.name.includes(place.name) ||
            place.name.includes(p.name);
          // 좌표도 근접한지 확인 (약 100m 이내)
          const distance = Math.sqrt(
            Math.pow(p.lat - place.lat, 2) + Math.pow(p.lng - place.lng, 2)
          );
          return nameMatch && distance < 0.001; // 약 100m
        });

        if (matchedPlace) {
          setPriceInfo(matchedPlace);
        } else {
          setPriceError('가격 정보를 찾을 수 없습니다.');
        }
      } catch (error) {
        console.error('가격 정보 조회 실패:', error);
        setPriceError('가격 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoadingPrice(false);
      }
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col shadow-xl relative overflow-hidden">
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
      >
        <X className="w-5 h-5 text-gray-600" />
      </button>

      {/* 장소 이미지 */}
      <div className="relative h-64 overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1693928105512-10516b969717?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxHeWVvbmdib2tndW5nJTIwUGFsYWNlJTIwU2VvdWx8ZW58MXx8fHwxNzYzNDU0MTk3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt={place.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          <h2 className="text-white text-2xl">
            {isTranslating ? place.name : translatedName}
          </h2>
          {place.category && (
            <div className="mt-2">
              <span className="inline-block px-3 py-1 bg-blue-500/80 text-white text-xs rounded-full">
                {isTranslating ? place.category : translatedCategory}
              </span>
            </div>
          )}
          {place.address && (
            <p className="text-white/80 text-sm mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isTranslating ? place.address : translatedAddress}
            </p>
          )}
        </div>
      </div>

      {/* 탭 아이콘들 */}
      <div className="grid grid-cols-3 gap-3 p-6 border-b">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabClick(tab.id)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group ${activeTab === tab.id ? 'bg-gray-100' : ''
              }`}
          >
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${tab.color} flex items-center justify-center group-hover:scale-110 transition-transform ${activeTab === tab.id ? 'ring-2 ring-offset-2 ring-gray-400' : ''
              }`}>
              <tab.icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs text-gray-700">{t(tab.labelKey, uiLanguage)}</span>
          </button>
        ))}
      </div>

      {/* 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {activeTab === 'pricing' ? (
          // Pricing 탭 컨텐츠
          <div className="space-y-4 h-full">
            {isLoadingPrice ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
                  <p className="text-sm text-gray-600">가격 정보를 불러오는 중...</p>
                </div>
              </div>
            ) : priceError ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-600">{priceError}</p>
              </div>
            ) : priceInfo && priceInfo.menus.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">메뉴 및 가격</h3>
                  <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto pr-2">
                    {priceInfo.menus.map((menu, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 flex-1 break-words pr-2">
                          {menu.name}
                        </span>
                        {menu.price ? (
                          <span className="text-sm font-bold text-red-600 ml-4 whitespace-nowrap">
                            {menu.price.toLocaleString()}원
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 ml-4 whitespace-nowrap">가격 정보 없음</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 text-center">
                      총 {priceInfo.menu_count}개 메뉴
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600">가격 정보가 없습니다.</p>
              </div>
            )}
          </div>
        ) : (
          // 기본 Info 탭 컨텐츠
          <div className="space-y-4">
            <div>
              <h3 className="text-gray-900 mb-2">{t('placepopup.basicInformation', uiLanguage)}</h3>
              <p className="text-sm text-gray-600">
                {t('placepopup.basicInfoDescription', uiLanguage)}
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-gray-900 mb-2">{t('placepopup.operatingHours', uiLanguage)}</h3>
              <p className="text-sm text-gray-600">{t('placepopup.operatingHoursValue', uiLanguage)}</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-gray-900 mb-2">{t('placepopup.admissionFee', uiLanguage)}</h3>
              <p className="text-sm text-gray-600">{t('placepopup.admissionFeeValue', uiLanguage)}</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-gray-900 mb-2">{t('placepopup.address', uiLanguage)}</h3>
              <p className="text-sm text-gray-600">{isTranslating ? (place.address || t('placepopup.addressValue', uiLanguage)) : (translatedAddress || t('placepopup.addressValue', uiLanguage))}</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-gray-900 mb-2">{t('placepopup.recommendedRoute', uiLanguage)}</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• {t('placepopup.recommendedRouteValue1', uiLanguage)}</li>
                <li>• {t('placepopup.recommendedRouteValue2', uiLanguage)}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}