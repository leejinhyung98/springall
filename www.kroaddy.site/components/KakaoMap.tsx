"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createMarkerTooltipContent } from "./MarkerTooltip";
import { Location, LanguageCode, PlaceWithMenu } from "../lib/types";
import { keywordPlaceMap } from "../lib/keywordPlaces";
import { searchContentId, fetchTourImages } from "../lib/tourApi";
import { getCurrentLanguage, t } from "../lib/i18n";
import { fetchPlacesWithPrices } from "../lib/crawlerApi";

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  route?: Location[];
  searchKeyword?: string;
  onPlaceClick?: (place: Location) => void;
  resetKey?: number; // 초기화를 위한 키
  drawRouteKey?: number; // 경로를 그릴지 말지 제어하는 키
  onLocationUpdate?: (location: { lat: number; lng: number }) => void; // 현재 위치 업데이트 콜백
}

// 전역으로 onPlaceClick 저장 (이벤트 핸들러에서 접근하기 위해)
let globalOnPlaceClick: ((place: Location) => void) | undefined = undefined;

// LanguageCode를 카카오 지도 언어 코드로 변환
// 카카오 지도는 ko, en, ja, zh만 지원합니다
const getKakaoMapLang = (langCode: LanguageCode): string => {
  const langMap: Record<LanguageCode, string> = {
    'ko': 'ko',
    'en': 'en',
    'ja': 'ja',
    'zh-CN': 'zh',  // 중국어 간체는 zh로 통일
    'zh-TW': 'zh',  // 중국어 번체도 zh로 통일
    'fr': 'en',     // 지원하지 않는 언어는 영어로 폴백
    'de': 'en',
    'vi': 'en',
    'id': 'en',
    'th': 'en',
    'ar': 'en',
    'mn': 'en',
    'pt': 'en',
    'es': 'en',
    'it': 'en',
    'uz': 'en',
    'km': 'en',
    'ne': 'en',
  };
  return langMap[langCode] || 'en';
};


export default function KakaoMapPage({ route = [], searchKeyword = '', onPlaceClick, resetKey = 0, drawRouteKey = 0, onLocationUpdate }: KakaoMapProps) {
  const mapRef = useRef<any>(null);
  const [mapKey, setMapKey] = useState(0); // 지도 재초기화를 위한 키
  const [scriptLoaded, setScriptLoaded] = useState(false); // Script 로드 상태
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const markersRef = useRef<any[]>([]);
  // 마커 hover tooltip 저장
  const markerTooltipsRef = useRef<Map<any, any>>(new Map());
  // 키워드 검색으로 생성된 마커 (route와 별도 관리)
  const searchMarkersRef = useRef<any[]>([]);
  // 현재 위치 마커 및 원형 오버레이
  const currentLocationMarkerRef = useRef<any>(null);
  const currentLocationCircleRef = useRef<any>(null);
  // 현재 위치 좌표 저장
  const currentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // 위치 추적 watch ID 저장 (cleanup용)
  const watchPositionIdRef = useRef<number | null>(null);
  // 경로 Polyline 저장
  const routePolylineRef = useRef<any>(null);
  // 마커의 실제 위치 저장 (location.id -> 실제 좌표)
  const markerPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  // 가격 정보 마커 및 오버레이 저장
  const priceMarkersRef = useRef<any[]>([]);
  const priceOverlaysRef = useRef<any[]>([]);
  // 가격 정보 표시 활성화 상태
  const [showPriceInfo, setShowPriceInfo] = useState(true);
  // 현재 지도 중심 좌표
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  // 현재 언어 상태
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(getCurrentLanguage());
  // 경로확인 활성화 상태
  const [isRouteCheckActive, setIsRouteCheckActive] = useState(false);
  // 경로확인 활성화 상태 ref (클로저 문제 해결용)
  const isRouteCheckActiveRef = useRef(false);
  // 이미지 표시 상태
  const [showStreetView, setShowStreetView] = useState(false);
  // 클릭한 장소 정보 (이미지 표시용)
  const [selectedPlaceForImage, setSelectedPlaceForImage] = useState<Location | null>(null);
  // 현재 경로 인덱스 (이미지 뷰에서 경로 이동용)
  const [currentRouteIndex, setCurrentRouteIndex] = useState<number>(-1);

  // 장소별 이미지 매핑
  const placeImageMap: Record<string, string> = {
    '광장시장': '/place/kwangjang.png',
    '경복궁': '/place/kyungbok.png',
    '청계천': '/place/chun.png',
    '명동대성당': '/place/myungdong.png',
    '꽃밥에 피다 북촌 친환경 그로서란트': '/place/kotbab.png',
    '비건 인사 채식당': '/place/dongdaemunddp.png',
    '채식요리전문점 오세계향': '/place/dongdaemunddp.png',
    '카페 수달': '/place/dongdaemunddp.png',
    '청수당 베이커리': '/place/sudang.png',
    '서울 역사 박물관': '/place/dongdaemunddp.png',
    '대한민국 역사 박물관': '/place/dongdaemunddp.png',
    '국립 고궁 박물관': '/place/dongdaemunddp.png',
    '국립 민속 박물관': '/place/dongdaemunddp.png',
    '국립 중앙 박물관': '/place/dongdaemunddp.png',
    '동대문': '/place/dongdaemun.png',
    '동대문디자인플라자': '/place/dongdaemunddp.png',
    '동대문 디자인 플라자': '/place/dongdaemunddp.png',
    'DDP': '/place/dongdaemunddp.png',
    '동대문역사문화공원': '/place/dongdaemunddp.png',
  };

  const KAKAO_MAP_API_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;

  // Tour API 이미지 캐시 (같은 장소에 대해 중복 요청 방지)
  const tourImageCache = useRef<Map<string, string>>(new Map());

  // 마커 hover 시 Tour API에서 이미지 가져오기
  async function onMarkerHover(location: Location) {
    try {
      // 캐시 확인
      if (tourImageCache.current.has(location.id)) {
        return tourImageCache.current.get(location.id) || null;
      }

      // 1) 장소명 → contentId
      const contentId = await searchContentId(location.name);
      if (!contentId) {
        console.warn("Tour API 결과 없음. 기본 이미지 사용");
        return null;
      }

      // 2) contentId → 이미지
      const images = await fetchTourImages(contentId);

      const imageUrl = images.length > 0 ? images[0] : null;

      if (imageUrl) {
        tourImageCache.current.set(location.id, imageUrl);
      }

      return imageUrl;
    } catch (e) {
      console.error(e);
      return null;
    }
  }


  // 현재 위치가 동대문디자인플라자(DDP) 근처인지 확인하는 함수
  const isNearDDP = (lat: number, lng: number): boolean => {
    // 동대문 디자인플라자(DDP) 근처 좌표 범위
    // DDP 좌표: 약 37.5665, 127.0090
    // 약 300m 반경 내에 있으면 DDP로 판단
    const ddpLat = 37.5665;
    const ddpLng = 127.0090;
    const radius = 0.003; // 약 300m (위도/경도 차이)

    const latDiff = Math.abs(lat - ddpLat);
    const lngDiff = Math.abs(lng - ddpLng);

    return latDiff < radius && lngDiff < radius;
  };

  // 현재 위치가 동대문 근처인지 확인하는 함수 (일반 동대문)
  const isNearDongdaemun = (lat: number, lng: number): boolean => {
    // 동대문 근처 좌표 범위 (DDP보다 넓은 범위)
    // 동대문 좌표: 약 37.5714, 127.0097
    // 약 500m 반경 내에 있으면 동대문으로 판단
    const dongdaemunLat = 37.5714;
    const dongdaemunLng = 127.0097;
    const radius = 0.005; // 약 500m (위도/경도 차이)

    const latDiff = Math.abs(lat - dongdaemunLat);
    const lngDiff = Math.abs(lng - dongdaemunLng);

    return latDiff < radius && lngDiff < radius;
  };

  // 장소에 매핑된 이미지가 있는지 확인하는 함수
  const hasMappedImage = (place: Location): boolean => {
    // 1순위: 정확한 장소명으로 매핑 확인
    if (placeImageMap[place.name]) {
      return true;
    }

    // 2순위: 장소 ID로 매핑 확인
    const idImageMap: Record<string, string> = {
      'place1': '/place/kyungbok.png', // 경복궁
      'place4': '/place/kotbab.png', // 꽃밥에 피다
      'place10': '/place/kwangjang.png', // 광장시장
      'place2': '/place/chun.png', // 청계천
      'place3': '/place/myungdong.png', // 명동대성당
      'place9': '/place/sudang.png', // 청수당 베이커리
    };
    if (idImageMap[place.id]) {
      return true;
    }

    // 3순위: 장소명에 키워드가 포함되어 있는지 확인
    const name = place.name;
    if (name.includes('경복궁') ||
      name.includes('꽃밥') || name.includes('꽃밥에 피다') ||
      name.includes('광장시장') ||
      name.includes('청계천') ||
      name.includes('명동대성당') || name.includes('명동 대성당') ||
      name.includes('청수당') ||
      name.includes('동대문디자인플라자') || name.includes('동대문 디자인 플라자') || name.includes('DDP') || name.includes('동대문역사문화공원') ||
      name.includes('동대문')) {
      return true;
    }

    return false;
  };

  // 현재 위치에 매핑된 이미지가 있는지 확인하는 함수
  const getCurrentLocationImage = (): string | null => {
    if (!currentLocationRef.current) return null;

    const { lat, lng } = currentLocationRef.current;

    // 1순위: 동대문디자인플라자(DDP) 근처인지 확인 (더 좁은 범위)
    if (isNearDDP(lat, lng)) {
      return '/place/dongdaemunddp.png';
    }

    // 2순위: 일반 동대문 근처인지 확인 (더 넓은 범위)
    if (isNearDongdaemun(lat, lng)) {
      return '/place/dongdaemun.png';
    }

    return null;
  };

  // onPlaceClick을 전역에 저장 (이벤트 핸들러에서 접근하기 위해)
  useEffect(() => {
    // 경로확인이 활성화된 상태에서 장소를 클릭하면 이미지 표시 (매핑된 이미지가 있을 때만)
    globalOnPlaceClick = (place: Location) => {
      if (isRouteCheckActive) {
        // 활성화된 상태에서 장소 클릭 시 매핑된 이미지가 있을 때만 표시
        if (hasMappedImage(place)) {
          const mappedRoute = getMappedRoute();
          // 클릭한 장소의 인덱스 찾기
          const index = mappedRoute.findIndex((loc: Location) => loc.id === place.id);
          if (index !== -1) {
            setCurrentRouteIndex(index);
          } else {
            setCurrentRouteIndex(-1);
          }
          setSelectedPlaceForImage(place);
          setShowStreetView(true);
        } else {
          // 매핑된 이미지가 없으면 PlacePopup 열기
          if (onPlaceClick) {
            onPlaceClick(place);
          }
        }
      } else {
        // 비활성화 상태에서는 기존 동작 (PlacePopup 열기)
        if (onPlaceClick) {
          onPlaceClick(place);
        }
      }
    };
  }, [onPlaceClick, isRouteCheckActive]);

  // 기존 마커와 tooltip 제거 (route 기반만)
  const clearOverlays = () => {
    markersRef.current.forEach((marker) => {
      if (marker) marker.setMap(null);
    });
    markersRef.current = [];

    // tooltip 제거
    markerTooltipsRef.current.forEach((tooltip) => {
      if (tooltip) tooltip.setMap(null);
    });
    markerTooltipsRef.current.clear();

    // 마커 위치 정보 초기화
    markerPositionsRef.current.clear();
  };


  // 키워드 검색으로 생성된 마커 제거
  const clearSearchMarkers = () => {
    searchMarkersRef.current.forEach((marker) => {
      if (marker) {
        marker.setMap(null);
        // 검색 마커의 tooltip도 제거
        const tooltip = markerTooltipsRef.current.get(marker);
        if (tooltip) {
          tooltip.setMap(null);
          markerTooltipsRef.current.delete(marker);
        }
      }
    });
    searchMarkersRef.current = [];
  };

  // 가격 정보 마커 및 오버레이 제거
  const clearPriceMarkers = () => {
    priceMarkersRef.current.forEach((marker) => {
      if (marker) marker.setMap(null);
    });
    priceMarkersRef.current = [];
    
    priceOverlaysRef.current.forEach((overlay) => {
      if (overlay) overlay.setMap(null);
    });
    priceOverlaysRef.current = [];
  };

  // 가격 정보 오버레이 콘텐츠 생성
  const createPriceOverlayContent = (place: PlaceWithMenu): string => {
    const menuList = place.menus
      .slice(0, 5) // 최대 5개만 표시
      .map(
        (menu) =>
          `<div style="padding: 4px 0; border-bottom: 1px solid #eee; font-size: 12px;">
            <span style="font-weight: 500; color: #333;">${menu.name}</span>
            ${menu.price ? `<span style="color: #ff6b6b; margin-left: 8px; font-weight: bold;">${menu.price.toLocaleString()}원</span>` : '<span style="color: #999; margin-left: 8px;">가격 정보 없음</span>'}
          </div>`
      )
      .join("");

    return `
      <div style="
        background: white;
        border: 2px solid #ff6b6b;
        border-radius: 8px;
        padding: 12px;
        min-width: 200px;
        max-width: 250px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; color: #333;">
          ${place.name}
        </div>
        ${place.category ? `<div style="font-size: 11px; color: #666; margin-bottom: 6px;">${place.category}</div>` : ""}
        <div style="max-height: 200px; overflow-y: auto; margin-top: 8px;">
          ${menuList || "<div style='color: #999; font-size: 11px;'>메뉴 정보 없음</div>"}
        </div>
        ${place.menus.length > 5 ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">외 ${place.menus.length - 5}개 메뉴</div>` : ""}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 11px; color: #666;">
          총 ${place.menu_count}개 메뉴
        </div>
      </div>
    `;
  };

  // 가격 정보가 있는 장소를 지도에 표시
  const displayPriceMarkers = async (map: any, lat: number, lng: number, radius: number = 1000) => {
    if (!showPriceInfo) return;

    // 기존 가격 정보 마커 제거
    clearPriceMarkers();

    try {
      const places = await fetchPlacesWithPrices(lat, lng, radius);
      
      places.forEach((place) => {
        if (place.menu_count === 0) return; // 메뉴가 없는 장소는 표시하지 않음

        // 마커 위치
        const markerPosition = new window.kakao.maps.LatLng(place.lat, place.lng);

        // 가격 정보가 있는 장소는 빨간색 마커 사용
        const markerImageSrc = '/img/marker-red.png';
        const img = new Image();
        img.onload = () => {
          const displayHeight = 40;
          const aspectRatio = img.width / img.height;
          const displayWidth = displayHeight * aspectRatio;

          const markerImageSize = new window.kakao.maps.Size(displayWidth, displayHeight);
          const markerImageOption = {
            offset: new window.kakao.maps.Point(displayWidth / 2, displayHeight)
          };
          const markerImage = new window.kakao.maps.MarkerImage(
            markerImageSrc,
            markerImageSize,
            markerImageOption
          );

          // 마커 생성
          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            image: markerImage,
            map: map
          });

          // 가격 정보 오버레이 생성
          const content = createPriceOverlayContent(place);
          const overlay = new window.kakao.maps.CustomOverlay({
            content: content,
            position: markerPosition,
            yAnchor: 2.2,
            xAnchor: 0.5
          });

          // 마커 클릭 이벤트
          window.kakao.maps.event.addListener(marker, "click", () => {
            // 다른 오버레이 숨기기
            priceOverlaysRef.current.forEach(ov => {
              if (ov !== overlay) ov.setMap(null);
            });
            // 클릭한 오버레이 표시/숨김 토글
            if (overlay.getMap()) {
              overlay.setMap(null);
            } else {
              overlay.setMap(map);
            }
          });

          priceMarkersRef.current.push(marker);
          priceOverlaysRef.current.push(overlay);
        };
        img.src = markerImageSrc;
      });
    } catch (error) {
      console.error("가격 정보 마커 표시 실패:", error);
    }
  };

  // 현재 위치 마커 제거
  const clearCurrentLocationMarker = () => {
    if (currentLocationMarkerRef.current) {
      // CustomOverlay인 경우
      if (currentLocationMarkerRef.current.setMap) {
        currentLocationMarkerRef.current.setMap(null);
      }
      currentLocationMarkerRef.current = null;
    }
    if (currentLocationCircleRef.current) {
      if (currentLocationCircleRef.current.setMap) {
        currentLocationCircleRef.current.setMap(null);
      }
      currentLocationCircleRef.current = null;
    }
  };

  // 경로 그리기 (현재 위치에서 route의 장소들까지)
  const drawRoute = (map: any) => {
    // 기존 경로 제거
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    // 현재 위치와 route가 모두 있어야 경로를 그릴 수 있음
    if (!currentLocationRef.current || !route || route.length === 0) {
      console.log('[경로 그리기] 조건 불만족:', {
        현재위치: currentLocationRef.current,
        route길이: route?.length
      });
      return;
    }

    // 디버깅: 경로 그리기 시작 로그
    console.log('[경로 그리기] 시작:', {
      현재위치: currentLocationRef.current,
      route장소수: route.length,
      마커위치저장수: markerPositionsRef.current.size
    });

    // route를 order 순서대로 정렬 (order가 없으면 기존 순서 유지)
    const sortedRoute = [...route].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      return orderA - orderB;
    });

    // 경로 좌표 배열 생성 (현재 위치 -> route의 각 장소)
    const path: any[] = [];

    // 현재 위치를 시작점으로 추가
    path.push(new window.kakao.maps.LatLng(
      currentLocationRef.current.lat,
      currentLocationRef.current.lng
    ));

    // 정렬된 route의 각 장소를 순서대로 추가 (마커의 실제 위치 사용)
    sortedRoute.forEach((location, index) => {
      // 마커의 실제 위치가 있으면 사용, 없으면 route의 좌표 사용
      const actualPosition = markerPositionsRef.current.get(location.id);
      if (actualPosition) {
        path.push(new window.kakao.maps.LatLng(actualPosition.lat, actualPosition.lng));
        console.log(`[경로 포인트 ${index + 1}] ${location.name}: 마커 위치 사용`, actualPosition);
      } else {
        // 마커가 아직 생성되지 않았거나 위치 정보가 없는 경우 route 좌표 사용
        path.push(new window.kakao.maps.LatLng(location.lat, location.lng));
        console.warn(`[경로 포인트 ${index + 1}] ${location.name}: 마커 위치 없음, route 좌표 사용`, { lat: location.lat, lng: location.lng });
      }
    });

    // Polyline으로 경로 그리기
    const polyline = new window.kakao.maps.Polyline({
      path: path,
      strokeWeight: 5,
      strokeColor: '#4285F4',
      strokeOpacity: 0.7,
      strokeStyle: 'solid',
    });

    polyline.setMap(map);
    routePolylineRef.current = polyline;

    // 지도 범위를 현재 위치와 모든 장소를 포함하도록 조정
    const bounds = new window.kakao.maps.LatLngBounds();
    bounds.extend(new window.kakao.maps.LatLng(
      currentLocationRef.current.lat,
      currentLocationRef.current.lng
    ));
    sortedRoute.forEach((location) => {
      // 마커의 실제 위치가 있으면 사용, 없으면 route 좌표 사용
      const actualPosition = markerPositionsRef.current.get(location.id);
      if (actualPosition) {
        bounds.extend(new window.kakao.maps.LatLng(actualPosition.lat, actualPosition.lng));
      } else {
        bounds.extend(new window.kakao.maps.LatLng(location.lat, location.lng));
      }
    });
    map.setBounds(bounds);
  };

  // 현재 위치 업데이트 함수 (위치가 변경될 때마다 호출)
  const updateCurrentLocation = (map: any, position: GeolocationPosition) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const currentPosition = new window.kakao.maps.LatLng(lat, lng);

    // 현재 위치 좌표 저장
    const previousLocation = currentLocationRef.current;
    currentLocationRef.current = { lat, lng };

    // 디버깅: 현재 위치 로그
    console.log('[현재 위치 업데이트]', {
      lat,
      lng,
      정확도: position.coords.accuracy + 'm',
      이전위치: previousLocation
    });

    // 위치 정보를 부모 컴포넌트로 전달
    if (onLocationUpdate) {
      onLocationUpdate({ lat, lng });
    }

    // 첫 위치 설정 시에만 지도 중심 이동
    if (!previousLocation) {
      map.setCenter(currentPosition);
      map.setLevel(3); // 좀 더 가까운 레벨로 설정
    }

    // 기존 현재 위치 마커 제거
    clearCurrentLocationMarker();

    // 현재 위치에 원형 오버레이 추가 (반경 표시)
    const circle = new window.kakao.maps.Circle({
      center: currentPosition,
      radius: 50, // 50미터 반경
      strokeWeight: 2,
      strokeColor: '#4285F4',
      strokeOpacity: 0.6,
      fillColor: '#4285F4',
      fillOpacity: 0.15,
    });
    circle.setMap(map);
    currentLocationCircleRef.current = circle;

    // 현재 위치 마커 생성 (SVG로 파란색 원형 마커 생성)
    const markerContent = `
      <div style="
        width: 20px;
        height: 20px;
        background-color: #4285F4;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `;

    const customOverlay = new window.kakao.maps.CustomOverlay({
      position: currentPosition,
      content: markerContent,
      yAnchor: 0.5,
      xAnchor: 0.5,
    });
    customOverlay.setMap(map);

    // 마커 참조 저장 (CustomOverlay를 마커처럼 사용)
    currentLocationMarkerRef.current = customOverlay;

    // 경로 그리기 (route가 있고 경로가 이미 그려져 있으면 업데이트)
    if (route && route.length > 0 && routePolylineRef.current) {
      drawRoute(map);
    }
  };

  // 현재 위치 가져오기 및 지속 추적
  const setCurrentLocation = (map: any) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      // 기본 위치(서울시청) 사용
      const defaultPosition = { lat: 37.5665, lng: 126.9780 };
      currentLocationRef.current = defaultPosition;
      if (onLocationUpdate) {
        onLocationUpdate(defaultPosition);
      }
      return;
    }

    // 기존 watchPosition이 있으면 정리
    if (watchPositionIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchPositionIdRef.current);
      watchPositionIdRef.current = null;
    }

    // 먼저 현재 위치를 한 번 가져오기
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateCurrentLocation(map, position);
      },
      (error) => {
        console.warn('Error getting current location:', error);
        // 위치를 가져오지 못하면 기본 위치(서울시청) 사용
        const defaultPosition = { lat: 37.5665, lng: 126.9780 };
        currentLocationRef.current = defaultPosition;
        if (onLocationUpdate) {
          onLocationUpdate(defaultPosition);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    // 위치 변경을 지속적으로 추적
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateCurrentLocation(map, position);
      },
      (error) => {
        console.warn('Error watching position:', error);
        // 에러가 발생해도 기존 위치 유지
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000, // 30초 이내의 캐시된 위치 허용
      }
    );

    watchPositionIdRef.current = watchId;
  };

  // route에 따라 마커와 오버레이 생성 (오버레이는 숨김 상태)
  const createOverlays = (map: any) => {
    if (!route || route.length === 0) return;

    const places = new window.kakao.maps.services.Places();

    route.forEach((location) => {
      // 카카오맵 Places API로 장소명으로 검색하여 좌표 가져오기
      const searchPlaceAndCreateMarker = () => {
        // 장소명으로 검색 (keywordPlaces.ts의 name 사용)
        places.keywordSearch(location.name, (data: any, status: any) => {
          let apiPlaceInfo: any = null;
          let markerPosition: { lat: number; lng: number } = { lat: location.lat, lng: location.lng };

          if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
            // 1순위: 장소명이 정확히 일치하는 것 찾기
            const exactMatch = data.find((place: any) => {
              return place.place_name === location.name ||
                place.place_name.replace(/\s/g, '') === location.name.replace(/\s/g, '');
            });

            if (exactMatch) {
              apiPlaceInfo = exactMatch;
              markerPosition = {
                lat: parseFloat(exactMatch.y),
                lng: parseFloat(exactMatch.x)
              };
            } else {
              // 2순위: 장소명이 포함되는 것 중에서 좌표가 가장 가까운 것 찾기
              const matchingPlaces = data.filter((place: any) => {
                return place.place_name.includes(location.name) ||
                  location.name.includes(place.place_name);
              });

              if (matchingPlaces.length > 0) {
                let nearestPlace = matchingPlaces[0];
                let minDistance = Infinity;

                matchingPlaces.forEach((place: any) => {
                  const placeLat = parseFloat(place.y);
                  const placeLng = parseFloat(place.x);
                  const distance = Math.sqrt(
                    Math.pow(placeLat - location.lat, 2) +
                    Math.pow(placeLng - location.lng, 2)
                  );

                  if (distance < minDistance && distance < 0.01) { // 약 1km 이내
                    minDistance = distance;
                    nearestPlace = place;
                  }
                });

                if (minDistance < Infinity) {
                  apiPlaceInfo = nearestPlace;
                  markerPosition = {
                    lat: parseFloat(nearestPlace.y),
                    lng: parseFloat(nearestPlace.x)
                  };
                }
              } else {
                // 3순위: 모든 결과 중에서 좌표가 가장 가까운 것 찾기
                let nearestPlace = data[0];
                let minDistance = Infinity;

                data.forEach((place: any) => {
                  const placeLat = parseFloat(place.y);
                  const placeLng = parseFloat(place.x);
                  const distance = Math.sqrt(
                    Math.pow(placeLat - location.lat, 2) +
                    Math.pow(placeLng - location.lng, 2)
                  );

                  if (distance < minDistance && distance < 0.01) { // 약 1km 이내
                    minDistance = distance;
                    nearestPlace = place;
                  }
                });

                if (minDistance < Infinity) {
                  apiPlaceInfo = nearestPlace;
                  markerPosition = {
                    lat: parseFloat(nearestPlace.y),
                    lng: parseFloat(nearestPlace.x)
                  };
                }
              }
            }
          }

          // API에서 가져온 정보로 Location 객체 생성
          const finalLocation: Location = apiPlaceInfo ? {
            ...location,
            lat: markerPosition.lat,
            lng: markerPosition.lng,
            name: apiPlaceInfo.place_name || location.name,
            address: apiPlaceInfo.road_address_name || apiPlaceInfo.address_name || location.address,
            category: apiPlaceInfo.category_name || location.category,
            phone: apiPlaceInfo.phone || location.phone,
            placeUrl: apiPlaceInfo.place_url || location.placeUrl,
          } : location;

          // 카테고리 확인하여 마커 이미지 결정
          // 음식점 카테고리: FD6 또는 category_name에 "음식" 포함
          const categoryName = finalLocation.category || '';
          const categoryCode = apiPlaceInfo?.category_group_code || '';
          const isRestaurant = categoryCode === 'FD6' ||
            categoryName.includes('음식') ||
            categoryName.includes('식당') ||
            categoryName.includes('레스토랑') ||
            categoryName.includes('카페');

          // 마커 이미지 선택 (음식점: 빨간색, 그 외: 파란색)
          const markerImageSrc = isRestaurant ? '/img/marker-red.png' : '/img/marker-blue.png';

          // 이미지 로드하여 원본 비율 계산 후 마커 생성 (스타일 효과 적용)
          const img = new Image();
          img.onload = () => {
            // 원본 이미지의 가로세로 비율 유지
            const originalWidth = img.width;
            const originalHeight = img.height;
            const aspectRatio = originalWidth / originalHeight;

            // 표시할 높이 설정 (적절한 크기로 조정)
            const displayHeight = 40;
            const displayWidth = displayHeight * aspectRatio;

            // Canvas를 사용하여 이미지에 스타일 효과 적용
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 그림자 공간을 포함한 캔버스 크기
            const shadowOffset = 2;
            const shadowBlur = 6;
            const padding = shadowBlur; // 그림자 공간만
            canvas.width = displayWidth + shadowOffset + padding * 2;
            canvas.height = displayHeight + shadowOffset + padding * 2;

            // 그림자 효과 설정 (더 연하게)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'; // 0.4 -> 0.2로 더 연하게
            ctx.shadowOffsetX = shadowOffset;
            ctx.shadowOffsetY = shadowOffset;
            ctx.shadowBlur = shadowBlur;

            // 이미지 그리기 (그림자 효과 포함)
            ctx.drawImage(
              img,
              padding,
              padding,
              displayWidth,
              displayHeight
            );

            // Canvas를 data URL로 변환
            const processedImageSrc = canvas.toDataURL('image/png');

            // 커스텀 마커 이미지 생성 (원본 비율 유지, 스타일 효과 적용)
            const totalWidth = displayWidth + shadowOffset + padding * 2;
            const totalHeight = displayHeight + shadowOffset + padding * 2;
            const markerImageSize = new window.kakao.maps.Size(
              totalWidth,
              totalHeight
            );

            const actualMarkerBottom = padding + displayHeight;

            const markerImageOption = {
              offset: new window.kakao.maps.Point(
                totalWidth / 2, // 가로 중앙
                actualMarkerBottom // 실제 마커 이미지의 하단 (뾰족한 부분)
              )
            };
            const markerImage = new window.kakao.maps.MarkerImage(
              processedImageSrc, // 처리된 이미지 사용
              markerImageSize,
              markerImageOption
            );

            // API에서 가져온 좌표로 마커 생성 (커스텀 이미지 사용)
            const marker = new window.kakao.maps.Marker({
              position: new window.kakao.maps.LatLng(markerPosition.lat, markerPosition.lng),
              image: markerImage, // 커스텀 마커 이미지
              map: map,
            });
            markersRef.current.push(marker);

            // 마커의 실제 위치 저장 (경로 그리기 시 사용)
            markerPositionsRef.current.set(finalLocation.id, {
              lat: markerPosition.lat,
              lng: markerPosition.lng
            });

            // 디버깅: 마커 위치 로그
            console.log(`[마커 생성] ${finalLocation.name}:`, {
              id: finalLocation.id,
              원본좌표: { lat: location.lat, lng: location.lng },
              실제좌표: markerPosition,
              API좌표: apiPlaceInfo ? { lat: parseFloat(apiPlaceInfo.y), lng: parseFloat(apiPlaceInfo.x) } : null
            });

            // 마커 생성 후 경로가 그려져야 하는 경우 경로 업데이트
            if (routePolylineRef.current && mapRef.current && currentLocationRef.current) {
              // 약간의 지연을 두고 경로 다시 그리기 (모든 마커가 생성될 수 있도록)
              setTimeout(() => {
                if (mapRef.current && currentLocationRef.current) {
                  drawRoute(mapRef.current);
                }
              }, 100);
            }

            // 마커 클릭 이벤트 - PlacePopup 열기
            window.kakao.maps.event.addListener(marker, "click", () => {
              if (globalOnPlaceClick) {
                globalOnPlaceClick(finalLocation);
              }
            });

            // Tooltip 생성 (API 정보 사용)
            const tooltipContent = createMarkerTooltipContent(finalLocation);
            const tooltipOverlay = new window.kakao.maps.CustomOverlay({
              position: new window.kakao.maps.LatLng(markerPosition.lat, markerPosition.lng),
              content: tooltipContent,
              yAnchor: 1.15, // 마커 위에 표시 (간격 조정)
              xAnchor: 0.5, // 중앙 정렬
              zIndex: 1000,
            });
            tooltipOverlay.setMap(null); // 초기에는 숨김
            markerTooltipsRef.current.set(marker, tooltipOverlay);

            // 마커에 mouseover 이벤트 추가 (마커 전체 영역)
            let isHovering = false; // 현재 hover 상태 추적
            window.kakao.maps.event.addListener(marker, "mouseover", async function () {
              isHovering = true;

              // 다른 tooltip 모두 숨김
              markerTooltipsRef.current.forEach((tooltip) => {
                if (tooltip && tooltip !== tooltipOverlay) {
                  tooltip.setMap(null);
                }
              });

              // 현재 tooltip 즉시 표시
              if (tooltipOverlay) {
                tooltipOverlay.setMap(map);
              }

              // Tour API에서 이미지 가져오기 (비동기, 백그라운드에서 처리)
              const tourImageUrl = await onMarkerHover(finalLocation);

              // hover 상태가 유지되고 있고, 이미지를 가져왔으면 tooltip의 이미지 업데이트
              if (isHovering && tourImageUrl && tooltipOverlay) {
                try {
                  // tooltip이 여전히 표시되어 있는지 확인
                  if (tooltipOverlay.getMap() === map) {
                    const tooltipContentStr = tooltipOverlay.getContent(); // 문자열 반환
                    if (tooltipContentStr) {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(tooltipContentStr, 'text/html');
                      const imgElement = doc.querySelector('.marker-tooltip-image img') as HTMLImageElement;
                      if (imgElement) {
                        imgElement.src = tourImageUrl;
                        tooltipOverlay.setContent(doc.body.innerHTML); // 변경 내용 반영
                      }
                    }
                  }
                } catch (e) {
                  console.error('Tooltip 이미지 업데이트 실패:', e);
                }
              }
            });

            // 마커에 mouseout 이벤트 추가
            window.kakao.maps.event.addListener(marker, "mouseout", function () {
              isHovering = false; // hover 상태 해제
              // tooltip 숨김
              if (tooltipOverlay) {
                tooltipOverlay.setMap(null);
              }
            });
          };
          img.src = markerImageSrc;

          // 마커의 hover 이벤트는 이미 위에서 처리되므로 추가 DOM 조작 불필요
        });
      };

      // 장소명으로 API 검색 후 마커 생성
      searchPlaceAndCreateMarker();
    });

    // 마커가 비동기로 생성되므로 bounds 조정은 마커 생성 후에 처리
    // 각 마커 생성 시 bounds에 추가하도록 수정 필요 (현재는 기본 bounds 사용)
    setTimeout(() => {
      if (route.length > 0 && markersRef.current.length > 0) {
        const bounds = new window.kakao.maps.LatLngBounds();

        // 현재 위치가 있으면 포함
        if (currentLocationRef.current) {
          bounds.extend(new window.kakao.maps.LatLng(
            currentLocationRef.current.lat,
            currentLocationRef.current.lng
          ));
        }

        // 생성된 마커들의 위치를 bounds에 추가
        markersRef.current.forEach((marker) => {
          if (marker && marker.getPosition) {
            bounds.extend(marker.getPosition());
          }
        });

        if (markersRef.current.length > 0) {
          map.setBounds(bounds);
        }
      }
    }, 1000); // 마커 생성 대기 시간
  };

  // 초기 Script 로드
  useEffect(() => {
    if (!KAKAO_MAP_API_KEY) return;

    const kakaoLang = getKakaoMapLang(currentLanguage);
    loadKakaoMapScript(kakaoLang);

    return () => {
      // 컴포넌트 언마운트 시 Script 제거
      if (scriptRef.current) {
        document.head.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, []); // 초기 마운트 시에만 실행

  // Script 로드 후 지도 초기화
  useEffect(() => {
    if (!KAKAO_MAP_API_KEY || !scriptLoaded) return;

    const initMap = () => {
      if (!window.kakao?.maps) return;

      window.kakao.maps.load(() => {
        const container = document.getElementById("map");
        if (!container) return;

        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 기본값 (서울시청)
          level: 5,
        });
        mapRef.current = map;

        // 현재 위치 가져오기 및 지도에 표시
        setCurrentLocation(map);

        // 지도 중심 변경 시 가격 정보 조회 (디바운싱 적용)
        let centerChangeTimer: NodeJS.Timeout | null = null;
        window.kakao.maps.event.addListener(map, "center_changed", () => {
          if (centerChangeTimer) clearTimeout(centerChangeTimer);
          centerChangeTimer = setTimeout(() => {
            const center = map.getCenter();
            const lat = center.getLat();
            const lng = center.getLng();
            setMapCenter({ lat, lng });
            if (showPriceInfo) {
              displayPriceMarkers(map, lat, lng, 1000);
            }
          }, 500); // 500ms 디바운싱
        });

        // 초기 가격 정보 조회
        const initialCenter = map.getCenter();
        const initialLat = initialCenter.getLat();
        const initialLng = initialCenter.getLng();
        setMapCenter({ lat: initialLat, lng: initialLng });
        if (showPriceInfo) {
          displayPriceMarkers(map, initialLat, initialLng, 1000);
        }

        // 지도 클릭 이벤트
        window.kakao.maps.event.addListener(map, "click", function (mouseEvent: any) {
          const latlng = mouseEvent.latLng;
          const clickedLat = latlng.getLat();
          const clickedLng = latlng.getLng();

          // 경로확인 활성화 상태에서 현재 위치 근처를 클릭했는지 확인
          if (isRouteCheckActiveRef.current && currentLocationRef.current) {
            const currentLat = currentLocationRef.current.lat;
            const currentLng = currentLocationRef.current.lng;
            // 약 50m 이내 클릭했는지 확인
            const distance = Math.sqrt(
              Math.pow(clickedLat - currentLat, 2) + Math.pow(clickedLng - currentLng, 2)
            );

            if (distance < 0.0005) { // 약 50m
              const currentLocationImage = getCurrentLocationImage();
              if (currentLocationImage) {
                const currentLocationPlace = getCurrentLocationAsPlace();
                if (currentLocationPlace) {
                  // 현재 위치의 인덱스는 항상 첫 번째 (0)
                  setCurrentRouteIndex(0);
                  setSelectedPlaceForImage(currentLocationPlace);
                  setShowStreetView(true);
                  return; // 현재 위치 클릭 처리 후 종료
                }
              }
            }
          }

          // 좌표로 주소 검색 및 주변 장소 검색
          const geocoder = new window.kakao.maps.services.Geocoder();
          const places = new window.kakao.maps.services.Places();

          // 주변 장소 검색 함수 (장소를 찾으면 true, 못 찾으면 false 반환)
          const searchNearbyPlace = (categories: string[], index: number, callback: (found: boolean, placeName?: string) => void) => {
            if (index >= categories.length) {
              // 모든 카테고리를 검색했는데 장소를 못 찾음
              callback(false);
              return;
            }

            places.categorySearch(categories[index], (data: any, searchStatus: any) => {
              if (searchStatus === window.kakao.maps.services.Status.OK && data.length > 0) {
                // 가장 가까운 장소 찾기
                let nearestPlace = null;
                let minDistance = Infinity;

                data.forEach((place: any) => {
                  const placeLat = parseFloat(place.y);
                  const placeLng = parseFloat(place.x);
                  const distance = Math.sqrt(
                    Math.pow(placeLat - latlng.getLat(), 2) +
                    Math.pow(placeLng - latlng.getLng(), 2)
                  );

                  if (distance < minDistance && distance < 0.0005) { // 약 50m 이내
                    minDistance = distance;
                    nearestPlace = place as any;
                  }
                });

                if (nearestPlace) {
                  // 장소를 찾았으면 이름 반환
                  callback(true, (nearestPlace as any).place_name);
                } else {
                  // 다음 카테고리 검색
                  searchNearbyPlace(categories, index + 1, callback);
                }
              } else {
                // 다음 카테고리 검색
                searchNearbyPlace(categories, index + 1, callback);
              }
            }, {
              location: latlng,
              radius: 100
            });
          };

          // 여러 카테고리 순차 검색 (음식점, 카페, 관광명소, 문화시설)
          const categories = ['FD6', 'CE7', 'AT4', 'CT1'];
          searchNearbyPlace(categories, 0, (found: boolean, placeName?: string) => {
            if (!found) {
              // 장소를 찾지 못했으면 마커를 생성하지 않음
              return;
            }

            // 장소를 찾았으면 PlacePopup 열기
            geocoder.coord2Address(latlng.getLng(), latlng.getLat(), (result: any, status: any) => {
              if (status === window.kakao.maps.services.Status.OK) {
                const addr = result[0].road_address || result[0].address;
                const addressName = addr?.road_address_name || addr?.address_name || "주소 검색 중...";

                const tempLocation: Location = {
                  id: `click-${Date.now()}`,
                  name: placeName || "장소",
                  address: addressName,
                  lat: latlng.getLat(),
                  lng: latlng.getLng(),
                };

                // PlacePopup 열기
                if (globalOnPlaceClick) {
                  globalOnPlaceClick(tempLocation);
                }

                map.panTo(latlng);
              }
            });
          });

          // 드래그 이벤트는 마커 생성 후에만 등록되므로 여기서는 처리하지 않음
          // 마커 생성 시점에 드래그 이벤트 리스너를 등록해야 함
        });

        // route가 있으면 오버레이 생성
        if (route && route.length > 0) {
          createOverlays(map);
        }
      });
    };

    if (window.kakao?.maps?.load) {
      initMap();
    } else {
      const handler = () => initMap();
      window.addEventListener("kakaoMapLoaded", handler);
      return () => window.removeEventListener("kakaoMapLoaded", handler);
    }
  }, [scriptLoaded, route, KAKAO_MAP_API_KEY]);

  // Script 동적 로드 함수
  const loadKakaoMapScript = useCallback((lang: string) => {
    console.log('카카오 지도 Script 로드 시작, 언어:', lang);

    // 기존 Script 모두 제거 (모든 카카오 지도 관련 Script 찾기)
    const existingScripts = document.querySelectorAll('script[src*="dapi.kakao.com"]');
    existingScripts.forEach(script => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    });
    scriptRef.current = null;

    // window.kakao 객체 완전히 제거
    if (window.kakao) {
      try {
        delete (window as any).kakao;
      } catch (e) {
        (window as any).kakao = undefined;
      }
    }

    // scriptLoaded 상태 초기화
    setScriptLoaded(false);

    // 지도 컨테이너 비우기
    const container = document.getElementById("map");
    if (container) {
      container.innerHTML = '';
    }

    // 새 Script 생성
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_API_KEY}&autoload=false&libraries=services&lang=${lang}`;
    script.async = true;
    script.onload = () => {
      console.log('카카오 지도 Script 로드 완료, 언어:', lang);
      setScriptLoaded(true);
      setTimeout(() => {
        window.dispatchEvent(new Event("kakaoMapLoaded"));
      }, 200);
    };
    script.onerror = () => {
      console.error('카카오 지도 SDK 로드 실패');
      setScriptLoaded(false);
    };
    document.head.appendChild(script);
    scriptRef.current = script;
  }, [KAKAO_MAP_API_KEY]);

  // 언어 변경 감지 및 지도 언어 업데이트
  useEffect(() => {
    const handleLanguageChange = () => {
      const newLang = getCurrentLanguage();
      const kakaoLang = getKakaoMapLang(newLang);

      console.log('언어 변경 감지:', newLang, '-> 카카오 지도 언어:', kakaoLang);
      console.log('handleLanguageChange 함수 실행 중...');

      setCurrentLanguage(newLang);
      console.log('setCurrentLanguage 호출 완료');

      // 지도 상태 저장 (지도가 초기화된 경우)
      console.log('지도 상태 저장 시작...');
      let savedCenter: any = null;
      let savedLevel = 5;

      if (mapRef.current && window.kakao?.maps) {
        try {
          savedCenter = mapRef.current.getCenter();
          savedLevel = mapRef.current.getLevel();
        } catch (e) {
          console.warn('지도 상태 저장 실패, 기본값 사용:', e);
        }
      }

      // 기본값 설정 (지도가 초기화되지 않은 경우)
      if (!savedCenter && window.kakao?.maps) {
        savedCenter = new window.kakao.maps.LatLng(37.5665, 126.9780);
      } else if (!savedCenter) {
        // window.kakao가 없는 경우, 나중에 설정
        savedCenter = { lat: 37.5665, lng: 126.9780 };
      }

      console.log('언어 변경 처리 시작, KAKAO_MAP_API_KEY:', KAKAO_MAP_API_KEY ? '존재' : '없음');

      try {
        // 기존 지도 제거
        if (mapRef.current) {
          console.log('기존 지도 제거 중...');
          // 모든 마커 제거
          markersRef.current.forEach(marker => {
            try {
              marker.setMap(null);
            } catch (e) {
              // 무시
            }
          });
          markersRef.current = [];
          searchMarkersRef.current.forEach(marker => {
            try {
              marker.setMap(null);
            } catch (e) {
              // 무시
            }
          });
          searchMarkersRef.current = [];
          // 현재 위치 마커 제거
          if (currentLocationMarkerRef.current) {
            try {
              currentLocationMarkerRef.current.setMap(null);
            } catch (e) {
              // 무시
            }
            currentLocationMarkerRef.current = null;
          }
          if (currentLocationCircleRef.current) {
            try {
              currentLocationCircleRef.current.setMap(null);
            } catch (e) {
              // 무시
            }
            currentLocationCircleRef.current = null;
          }
          // 경로 제거
          if (routePolylineRef.current) {
            try {
              routePolylineRef.current.setMap(null);
            } catch (e) {
              // 무시
            }
            routePolylineRef.current = null;
          }
        }

        mapRef.current = null;

        // 지도 컨테이너 완전히 비우기
        const container = document.getElementById("map");
        if (container) {
          container.innerHTML = '';
          console.log('지도 컨테이너 비움 완료');
        }

        // Script를 새 언어로 다시 로드
        console.log('loadKakaoMapScript 호출 전, 언어:', kakaoLang);
        if (!KAKAO_MAP_API_KEY) {
          console.error('KAKAO_MAP_API_KEY가 없습니다!');
          return;
        }
        loadKakaoMapScript(kakaoLang);
        console.log('loadKakaoMapScript 호출 완료');

        // Script 로드 완료 후 지도 재초기화를 위해 상태 저장
        const finalCenter = savedCenter;
        const finalLevel = savedLevel;

        // Script 로드 완료 이벤트 리스너
        const reinitHandler = () => {
          setTimeout(() => {
            if (window.kakao?.maps) {
              const mapContainer = document.getElementById("map");
              if (mapContainer) {
                window.kakao.maps.load(() => {
                  // center 좌표 처리
                  let centerLatLng;
                  if (finalCenter && typeof finalCenter.getLat === 'function') {
                    // 이미 LatLng 객체인 경우
                    centerLatLng = finalCenter;
                  } else if (finalCenter && finalCenter.lat && finalCenter.lng) {
                    // 일반 객체인 경우
                    centerLatLng = new window.kakao.maps.LatLng(finalCenter.lat, finalCenter.lng);
                  } else {
                    // 기본값
                    centerLatLng = new window.kakao.maps.LatLng(37.5665, 126.9780);
                  }

                  const newMap = new window.kakao.maps.Map(mapContainer, {
                    center: centerLatLng,
                    level: finalLevel,
                  });
                  mapRef.current = newMap;

                  console.log('지도 재초기화 완료, 언어:', kakaoLang);

                  // 지도가 완전히 로드된 후 언어 적용을 위해 약간의 지연 후 지도 갱신
                  setTimeout(() => {
                    // 지도를 약간 이동시켜서 다시 렌더링 (언어 적용을 위해)
                    const currentCenter = newMap.getCenter();
                    newMap.setCenter(new window.kakao.maps.LatLng(
                      currentCenter.getLat() + 0.00001,
                      currentCenter.getLng()
                    ));
                    setTimeout(() => {
                      newMap.setCenter(currentCenter);
                    }, 100);
                  }, 500);

                  // 현재 위치 다시 설정
                  setCurrentLocation(newMap);

                  // route가 있으면 오버레이 다시 생성
                  if (route && route.length > 0) {
                    createOverlays(newMap);
                  }
                });
              }
            }
            window.removeEventListener("kakaoMapLoaded", reinitHandler);
          }, 100);
        };

        window.addEventListener("kakaoMapLoaded", reinitHandler);
      } catch (error) {
        console.error('카카오 지도 언어 변경 실패:', error);
        console.error('에러 상세:', error);
      }
    };

    console.log('언어 변경 이벤트 리스너 등록');
    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    return () => {
      console.log('언어 변경 이벤트 리스너 제거');
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, [route, KAKAO_MAP_API_KEY, loadKakaoMapScript]);

  // route 변경 시 오버레이 업데이트 (경로는 자동으로 그리지 않음)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    clearOverlays();

    if (route && route.length > 0) {
      createOverlays(mapRef.current);
      // 경로는 "응" 입력 시에만 그리도록 함 (자동으로 그리지 않음)
    } else {
      // route가 비어있으면 경로 제거
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
    }
  }, [route]);

  // resetKey 변경 시 모든 마커와 오버레이 초기화
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    clearOverlays();
    clearSearchMarkers();
    // 경로 제거
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    // 현재 위치는 유지 (초기화하지 않음)
  }, [resetKey]);

  // 컴포넌트 언마운트 시 위치 추적 정리
  useEffect(() => {
    return () => {
      if (watchPositionIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
    };
  }, []);

  // drawRouteKey 변경 시 경로 그리기 ("응" 입력 시에만 경로를 그리도록 함)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    if (drawRouteKey === 0) return; // 초기값이면 경로를 그리지 않음

    // 현재 위치와 route가 모두 있으면 경로 그리기
    if (currentLocationRef.current && route && route.length > 0) {
      drawRoute(mapRef.current);
    }
  }, [drawRouteKey, route]);

  // 키워드 검색 처리 (카카오맵 API 기본 방식)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) {
      return;
    }

    // searchKeyword가 비어있으면 기존 검색 마커만 제거
    if (!searchKeyword.trim()) {
      clearSearchMarkers();
      return;
    }

    const map = mapRef.current;
    const places = new window.kakao.maps.services.Places();
    const infowindow = new window.kakao.maps.InfoWindow({ zIndex: 1 });

    // 기존 검색 마커 제거
    clearSearchMarkers();

    // 마커 표시 함수 (Location 타입 또는 Places API 결과 모두 처리)
    const displayMarkerFromLocation = (location: Location) => {
      // 마커 생성 및 지도에 표시
      const marker = new window.kakao.maps.Marker({
        map: map,
        position: new window.kakao.maps.LatLng(location.lat, location.lng)
      });

      searchMarkersRef.current.push(marker);

      // Tooltip 생성
      const tooltipContent = createMarkerTooltipContent(location);
      const tooltipOverlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(location.lat, location.lng),
        content: tooltipContent,
        yAnchor: 1.15, // 마커 위에 표시 (간격 조정)
        xAnchor: 0.5, // 중앙 정렬
        zIndex: 1000,
      });
      tooltipOverlay.setMap(null); // 초기에는 숨김
      markerTooltipsRef.current.set(marker, tooltipOverlay);

      // 마커에 mouseover 이벤트 추가
      let isHovering = false; // 현재 hover 상태 추적
      window.kakao.maps.event.addListener(marker, "mouseover", async function () {
        isHovering = true;

        // 다른 tooltip 모두 숨김
        markerTooltipsRef.current.forEach((tooltip) => {
          if (tooltip && tooltip !== tooltipOverlay) {
            tooltip.setMap(null);
          }
        });

        // 현재 tooltip 즉시 표시
        if (tooltipOverlay) {
          tooltipOverlay.setMap(map);
        }

        // Tour API에서 이미지 가져오기 (비동기, 백그라운드에서 처리)
        const tourImageUrl = await onMarkerHover(location);

        // hover 상태가 유지되고 있고, 이미지를 가져왔으면 tooltip의 이미지 업데이트
        if (isHovering && tourImageUrl && tooltipOverlay) {
          try {
            // tooltip이 여전히 표시되어 있는지 확인
            if (tooltipOverlay.getMap() === map) {
              const tooltipContentStr = tooltipOverlay.getContent(); // 문자열 반환
              if (tooltipContentStr) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(tooltipContentStr, 'text/html');
                const imgElement = doc.querySelector('.marker-tooltip-image img') as HTMLImageElement;
                if (imgElement) {
                  imgElement.src = tourImageUrl;
                  tooltipOverlay.setContent(doc.body.innerHTML); // 변경 내용 반영
                }
              }
            }
          } catch (e) {
            console.error('Tooltip 이미지 업데이트 실패:', e);
          }
        }
      });

      // 마커에 mouseout 이벤트 추가
      window.kakao.maps.event.addListener(marker, "mouseout", function () {
        isHovering = false; // hover 상태 해제
        // tooltip 숨김
        if (tooltipOverlay) {
          tooltipOverlay.setMap(null);
        }
      });

      // 마커 클릭 이벤트 등록
      window.kakao.maps.event.addListener(marker, 'click', () => {
        // 인포윈도우에 장소명 표시
        infowindow.setContent('<div style="padding:5px;font-size:12px;">' + location.name + '</div>');
        infowindow.open(map, marker);

        // PlacePopup도 열기
        if (globalOnPlaceClick) {
          globalOnPlaceClick(location);
        }
      });
    };

    // Places API 결과를 Location으로 변환하는 함수
    const displayMarkerFromPlace = (place: any) => {
      const location: Location = {
        id: place.id || `search-${Date.now()}`,
        name: place.place_name,
        address: place.road_address_name || place.address_name,
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
        phone: place.phone,
        category: place.category_name,
        placeUrl: place.place_url
      };
      displayMarkerFromLocation(location);
    };

    // 키워드에 '있을까?'가 포함되어 있는지 확인
    const keyword = searchKeyword.trim();
    const hasPlaceKeyword = keyword.includes('있을까?');

    // 미리 정의된 키워드 매핑 확인
    let matchedKeyword: string | undefined;
    if (hasPlaceKeyword) {
      matchedKeyword = '있을까?';
    } else {
      // 다른 키워드도 확인 (부분 일치)
      matchedKeyword = Object.keys(keywordPlaceMap).find(key => keyword.includes(key));
    }

    if (matchedKeyword && keywordPlaceMap[matchedKeyword]) {
      // 미리 정의된 장소 목록 사용
      // keywordPlaces.ts에 정의된 정확한 좌표를 그대로 사용
      keywordPlaceMap[matchedKeyword].forEach((location) => {
        // keywordPlaces.ts에 정의된 좌표를 직접 사용 (사용자가 수정한 정확한 좌표)
        displayMarkerFromLocation(location);
      });
    } else {
      // Places API로 검색
      places.keywordSearch(searchKeyword, (data: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          // 검색 결과를 마커로 표시
          data.forEach((place: any) => {
            displayMarkerFromPlace(place);
          });
        }
      });
    }
  }, [searchKeyword]);

  // 경로 확인 버튼 토글 핸들러
  const handleToggleRouteCheck = () => {
    // 활성화/비활성화 토글
    setIsRouteCheckActive(prev => {
      const newValue = !prev;
      isRouteCheckActiveRef.current = newValue;
      return newValue;
    });
  };

  // isRouteCheckActive 상태 변경 시 ref도 업데이트
  useEffect(() => {
    isRouteCheckActiveRef.current = isRouteCheckActive;
  }, [isRouteCheckActive]);

  // 현재 위치를 Location 객체로 변환하는 함수
  const getCurrentLocationAsPlace = (): Location | null => {
    if (!currentLocationRef.current) return null;

    const { lat, lng } = currentLocationRef.current;
    const currentLocationImage = getCurrentLocationImage();

    if (currentLocationImage) {
      // 현재 위치의 이미지에 따라 이름 설정
      let name = '현재 위치';
      if (isNearDDP(lat, lng)) {
        name = '동대문디자인플라자';
      } else if (isNearDongdaemun(lat, lng)) {
        name = '동대문';
      }

      return {
        id: 'current-location',
        name: name,
        address: '',
        lat: lat,
        lng: lng,
      };
    }

    return null;
  };

  // 매핑된 이미지가 있는 전체 경로 배열 생성 (현재 위치 + route)
  const getMappedRoute = (): Location[] => {
    const mappedRoute: Location[] = [];
    const addedIds = new Set<string>(); // 이미 추가된 장소 ID 추적
    const addedNames = new Set<string>(); // 이미 추가된 장소 이름 추적 (중복 방지용)

    // 1. 현재 위치 추가 (매핑된 이미지가 있는 경우만)
    const currentLocationPlace = getCurrentLocationAsPlace();
    if (currentLocationPlace) {
      mappedRoute.push(currentLocationPlace);
      addedIds.add(currentLocationPlace.id);
      addedNames.add(currentLocationPlace.name);

      // 현재 위치가 동대문디자인플라자일 때, 동대문을 두 번째 경로로 추가
      if (currentLocationPlace.name === '동대문디자인플라자') {
        const dongdaemunPlace: Location = {
          id: 'dongdaemun-next',
          name: '동대문',
          address: '서울특별시 종로구 종로 6가',
          lat: 37.5714,
          lng: 127.0097,
        };
        // 동대문이 이미 route에 포함되어 있지 않은 경우만 추가
        const isDongdaemunInRoute = route.some(loc =>
          loc.name === '동대문' ||
          (loc.name.includes('동대문') && !loc.name.includes('디자인플라자') && !loc.name.includes('DDP'))
        );
        if (!isDongdaemunInRoute && hasMappedImage(dongdaemunPlace)) {
          mappedRoute.push(dongdaemunPlace);
          addedIds.add(dongdaemunPlace.id);
          addedNames.add(dongdaemunPlace.name);
        }
      }
    }

    // 2. route에서 매핑된 이미지가 있는 장소만 추가
    if (route && route.length > 0) {
      // route를 order 순서대로 정렬
      const sortedRoute = [...route].sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : Infinity;
        const orderB = b.order !== undefined ? b.order : Infinity;
        return orderA - orderB;
      });

      sortedRoute.forEach((location) => {
        // 동대문은 이미 추가했으므로 제외 (동대문디자인플라자가 현재 위치일 때)
        if (currentLocationPlace?.name === '동대문디자인플라자') {
          const isDongdaemun = location.name === '동대문' ||
            (location.name.includes('동대문') && !location.name.includes('디자인플라자') && !location.name.includes('DDP'));
          if (isDongdaemun) {
            return; // 동대문은 이미 추가했으므로 건너뛰기
          }
        }

        // 중복 체크: 이미 추가된 장소는 건너뛰기
        if (addedIds.has(location.id) || addedNames.has(location.name)) {
          return;
        }

        if (hasMappedImage(location)) {
          mappedRoute.push(location);
          addedIds.add(location.id);
          addedNames.add(location.name);
        }
      });
    }

    return mappedRoute;
  };

  // 다음 경로로 이동
  const handleNextRoute = () => {
    const mappedRoute = getMappedRoute();
    if (currentRouteIndex < mappedRoute.length - 1) {
      const nextIndex = currentRouteIndex + 1;
      setCurrentRouteIndex(nextIndex);
      setSelectedPlaceForImage(mappedRoute[nextIndex]);
      setShowStreetView(true);
    }
  };

  // 이전 경로로 이동
  const handlePrevRoute = () => {
    const mappedRoute = getMappedRoute();
    if (currentRouteIndex > 0) {
      const prevIndex = currentRouteIndex - 1;
      setCurrentRouteIndex(prevIndex);
      setSelectedPlaceForImage(mappedRoute[prevIndex]);
      setShowStreetView(true);
    }
  };

  // 이미지 닫기 핸들러
  const handleCloseStreetView = () => {
    setShowStreetView(false);
    setSelectedPlaceForImage(null);
    setCurrentRouteIndex(-1);
  };

  // 이미지 표시 상태에 따라 현재 위치 마커와 원형 오버레이 표시/숨김
  useEffect(() => {
    if (!mapRef.current) return;

    if (showStreetView) {
      // 이미지가 표시되면 현재 위치 마커와 원형 오버레이 숨김
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setMap(null);
      }
      if (currentLocationCircleRef.current) {
        currentLocationCircleRef.current.setMap(null);
      }
    } else {
      // 이미지가 닫히면 현재 위치 마커와 원형 오버레이 다시 표시
      if (currentLocationRef.current && mapRef.current) {
        const currentPosition = new window.kakao.maps.LatLng(
          currentLocationRef.current.lat,
          currentLocationRef.current.lng
        );

        // 원형 오버레이 다시 표시
        if (currentLocationCircleRef.current) {
          currentLocationCircleRef.current.setMap(mapRef.current);
        } else if (window.kakao?.maps) {
          const circle = new window.kakao.maps.Circle({
            center: currentPosition,
            radius: 50,
            strokeWeight: 2,
            strokeColor: '#4285F4',
            strokeOpacity: 0.6,
            fillColor: '#4285F4',
            fillOpacity: 0.15,
          });
          circle.setMap(mapRef.current);
          currentLocationCircleRef.current = circle;
        }

        // 마커 다시 표시
        if (currentLocationMarkerRef.current) {
          currentLocationMarkerRef.current.setMap(mapRef.current);
        } else if (window.kakao?.maps) {
          const markerContent = `
            <div style="
              width: 20px;
              height: 20px;
              background-color: #4285F4;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            "></div>
          `;
          const customOverlay = new window.kakao.maps.CustomOverlay({
            position: currentPosition,
            content: markerContent,
            yAnchor: 0.5,
            xAnchor: 0.5,
          });
          customOverlay.setMap(mapRef.current);
          currentLocationMarkerRef.current = customOverlay;
        }
      }
    }
  }, [showStreetView]);

  // 지도 중심 변경 시 가격 정보 조회
  useEffect(() => {
    if (!mapCenter || !mapRef.current || !showPriceInfo) return;

    const timer = setTimeout(() => {
      displayPriceMarkers(mapRef.current, mapCenter.lat, mapCenter.lng, 1000);
    }, 500); // 디바운싱

    return () => clearTimeout(timer);
  }, [mapCenter, showPriceInfo]);

  // 가격 정보 표시 토글 시 마커 업데이트
  useEffect(() => {
    if (!mapRef.current || !mapCenter) return;

    if (showPriceInfo) {
      displayPriceMarkers(mapRef.current, mapCenter.lat, mapCenter.lng, 1000);
    } else {
      clearPriceMarkers();
    }
  }, [showPriceInfo]);

  // 선택된 장소에 맞는 이미지 URL 가져오기 (매핑이 없으면 null 반환)
  const getPlaceImageUrl = (place: Location | null): string | null => {
    if (!place) return null;

    // 현재 위치인 경우 특별 처리
    if (place.id === 'current-location') {
      return getCurrentLocationImage();
    }

    // 1순위: 정확한 장소명으로 매핑 확인
    let imageUrl = placeImageMap[place.name];

    // 2순위: 장소 ID로 매핑 확인
    if (!imageUrl) {
      const idImageMap: Record<string, string> = {
        'place1': '/place/kyungbok.png', // 경복궁
        'place4': '/place/kotbab.png', // 꽃밥에 피다
        'place10': '/place/kwangjang.png', // 광장시장
        'place2': '/place/chun.png', // 청계천
        'place3': '/place/myungdong.png', // 명동대성당
        'place9': '/place/sudang.png', // 청수당 베이커리
      };
      imageUrl = idImageMap[place.id];
    }

    // 3순위: 장소명에 키워드가 포함되어 있는지 확인
    if (!imageUrl) {
      const name = place.name;
      if (name.includes('경복궁')) {
        imageUrl = '/place/kyungbok.png';
      } else if (name.includes('꽃밥') || name.includes('꽃밥에 피다')) {
        imageUrl = '/place/kotbab.png';
      } else if (name.includes('광장시장')) {
        imageUrl = '/place/kwangjang.png';
      } else if (name.includes('청계천')) {
        imageUrl = '/place/chun.png';
      } else if (name.includes('명동대성당') || name.includes('명동 대성당')) {
        imageUrl = '/place/myungdong.png';
      } else if (name.includes('청수당')) {
        imageUrl = '/place/sudang.png';
      } else if (name.includes('동대문디자인플라자') || name.includes('동대문 디자인 플라자') || name.includes('DDP') || name.includes('동대문역사문화공원')) {
        imageUrl = '/place/dongdaemunddp.png';
      } else if (name.includes('동대문')) {
        imageUrl = '/place/dongdaemun.png';
      }
    }

    return imageUrl || null; // 매핑이 없으면 null 반환
  };

  return (
    <div className="relative w-full h-screen">
      {/* 지도 컨테이너 - 이미지가 표시되면 숨김 */}
      <div id="map" className={`w-full h-full ${showStreetView ? 'hidden' : ''}`} />

      {/* 장소별 이미지 - 이미지가 표시되면 보임 (매핑된 이미지가 있을 때만) */}
      {showStreetView && selectedPlaceForImage && getPlaceImageUrl(selectedPlaceForImage) && (() => {
        const mappedRoute = getMappedRoute();
        const canGoPrev = currentRouteIndex > 0;
        const canGoNext = currentRouteIndex >= 0 && currentRouteIndex < mappedRoute.length - 1;

        return (
          <div className="absolute inset-0 w-full h-full bg-black z-50 relative">
            {/* 닫기 버튼 */}
            <button
              onClick={handleCloseStreetView}
              className="absolute top-4 right-4 z-60 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <span>✕</span>
              <span>{t('map.closeStreetView', currentLanguage)}</span>
            </button>

            {/* 장소명 표시 */}
            <div className="absolute top-4 left-4 z-60 px-4 py-2 bg-black/70 text-white rounded-lg shadow-lg font-medium text-sm">
              {selectedPlaceForImage.name}
              {mappedRoute.length > 1 && currentRouteIndex >= 0 && (
                <span className="ml-2 text-xs opacity-70">
                  ({currentRouteIndex + 1} / {mappedRoute.length})
                </span>
              )}
            </div>

            {/* 경로 이동 버튼 - 오른쪽 중앙 */}
            {mappedRoute.length > 1 && currentRouteIndex >= 0 && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-60 flex flex-col gap-2">
                {/* 이전 버튼 */}
                <button
                  onClick={handlePrevRoute}
                  disabled={!canGoPrev}
                  className={`px-4 py-3 rounded-lg shadow-lg transition-all font-medium text-sm flex items-center gap-2 ${canGoPrev
                      ? 'bg-white/90 text-gray-900 hover:bg-white'
                      : 'bg-gray-400/50 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <span>◀</span>
                  <span>이전</span>
                </button>

                {/* 다음 버튼 */}
                <button
                  onClick={handleNextRoute}
                  disabled={!canGoNext}
                  className={`px-4 py-3 rounded-lg shadow-lg transition-all font-medium text-sm flex items-center gap-2 ${canGoNext
                      ? 'bg-white/90 text-gray-900 hover:bg-white'
                      : 'bg-gray-400/50 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <span>다음</span>
                  <span>▶</span>
                </button>
              </div>
            )}

            {/* 장소별 이미지 */}
            <img
              src={getPlaceImageUrl(selectedPlaceForImage)!}
              alt={selectedPlaceForImage.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // 이미지 로드 실패 시 경고 메시지
                console.warn('이미지 로드 실패:', selectedPlaceForImage.name);
                alert(t('map.imageLoadError', currentLanguage));
                setShowStreetView(false);
              }}
            />
          </div>
        );
      })()}

      {/* 경로확인 활성화 버튼 - 지도 왼쪽 하단, 스케일 바 위에 배치 (항상 표시) */}
      {!showStreetView && (
        <button
          onClick={handleToggleRouteCheck}
          className={`absolute bottom-16 left-4 z-10 px-4 py-2 rounded-lg shadow-lg transition-colors font-medium text-sm ${isRouteCheckActive
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          style={{
            // 카카오 지도 스케일 바 위에 배치 (스케일 바는 약 bottom: 10px, left: 10px 위치)
            bottom: '60px', // 스케일 바 위에 여유 공간을 두고 배치
            left: '16px',
          }}
        >
          {isRouteCheckActive ? t('map.routeCheckActive', currentLanguage) : t('map.checkRoute', currentLanguage)}
        </button>
      )}

      {/* 가격 정보 표시 토글 버튼 */}
      <button
        onClick={() => setShowPriceInfo(!showPriceInfo)}
        className={`absolute bottom-4 left-4 z-10 px-4 py-2 rounded-lg shadow-lg transition-colors font-medium text-sm ${
          showPriceInfo
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-500 text-white hover:bg-gray-600'
        }`}
        style={{
          bottom: isRouteCheckActive ? '120px' : '16px', // 경로 확인 버튼이 있으면 그 위에 배치
          left: '16px',
        }}
      >
        {showPriceInfo ? '가격 정보 숨기기' : '가격 정보 표시'}
      </button>
    </div>
  );
}