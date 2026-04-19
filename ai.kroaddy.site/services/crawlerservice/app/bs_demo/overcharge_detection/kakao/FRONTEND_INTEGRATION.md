# 카카오맵 가격 정보 프론트엔드 연동 가이드

## 개요

Neon DB에 저장된 크롤링 데이터를 카카오맵 API와 매핑하여 프론트엔드에 메뉴와 가격 정보를 표시하는 방법입니다.

## API 엔드포인트

### 1. 주변 장소 가격 정보 조회

```http
GET /kakao/places/nearby?lat=37.4980&lng=127.0276&radius=1000
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "kakao_place_id": "123456789",
      "name": "맛집 이름",
      "address": "서울시 강남구...",
      "lat": 37.4980,
      "lng": 127.0276,
      "phone": "02-1234-5678",
      "category": "음식점",
      "menus": [
        {"name": "김치찌개", "price": 8000},
        {"name": "된장찌개", "price": 7000}
      ],
      "menu_count": 2
    }
  ],
  "count": 1,
  "center": {"lat": 37.4980, "lng": 127.0276},
  "radius": 1000
}
```

### 2. 장소 ID로 조회

```http
GET /kakao/places/{place_id}
```

## 프론트엔드 연동 예제

### React/Next.js 예제

```typescript
// components/KakaoMapWithPrices.tsx
"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

interface PlaceWithMenu {
  id: number;
  kakao_place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  category?: string;
  menus: Array<{ name: string; price: number | null }>;
  menu_count: number;
}

interface KakaoMapWithPricesProps {
  centerLat: number;
  centerLng: number;
  radius?: number; // 미터 단위
  apiBaseUrl?: string; // 크롤러 서비스 URL (예: http://localhost:9001)
}

export default function KakaoMapWithPrices({
  centerLat,
  centerLng,
  radius = 1000,
  apiBaseUrl = "http://localhost:9001"
}: KakaoMapWithPricesProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [places, setPlaces] = useState<PlaceWithMenu[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithMenu | null>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);

  // 카카오맵 초기화
  useEffect(() => {
    if (!mapRef.current) return;

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&autoload=false`;
    script.async = true;

    script.onload = () => {
      window.kakao.maps.load(() => {
        const container = mapRef.current;
        const options = {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: 3
        };
        const kakaoMap = new window.kakao.maps.Map(container, options);
        setMap(kakaoMap);
      });
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [centerLat, centerLng]);

  // 주변 장소 가격 정보 조회
  useEffect(() => {
    if (!map) return;

    const fetchPlacesWithPrices = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/kakao/places/nearby?lat=${centerLat}&lng=${centerLng}&radius=${radius}`
        );
        const data = await response.json();

        if (data.success && data.data) {
          setPlaces(data.data);
          displayPlacesOnMap(data.data, map);
        }
      } catch (error) {
        console.error("주변 장소 조회 실패:", error);
      }
    };

    fetchPlacesWithPrices();
  }, [map, centerLat, centerLng, radius, apiBaseUrl]);

  // 지도에 장소 마커 표시
  const displayPlacesOnMap = (placesData: PlaceWithMenu[], kakaoMap: any) => {
    // 기존 마커와 오버레이 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    overlaysRef.current.forEach(overlay => overlay.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    placesData.forEach((place) => {
      // 마커 생성
      const markerPosition = new window.kakao.maps.LatLng(place.lat, place.lng);
      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        map: kakaoMap
      });

      // 커스텀 오버레이 생성 (가격 정보 표시)
      const content = createPriceOverlayContent(place);
      const overlay = new window.kakao.maps.CustomOverlay({
        content: content,
        position: markerPosition,
        yAnchor: 2.2,
        xAnchor: 0.5
      });

      // 마커 클릭 이벤트
      window.kakao.maps.event.addListener(marker, "click", () => {
        setSelectedPlace(place);
        // 다른 오버레이 숨기기
        overlaysRef.current.forEach(ov => {
          if (ov !== overlay) ov.setMap(null);
        });
        // 클릭한 오버레이 표시/숨김 토글
        if (overlay.getMap()) {
          overlay.setMap(null);
        } else {
          overlay.setMap(kakaoMap);
        }
      });

      markersRef.current.push(marker);
      overlaysRef.current.push(overlay);
    });
  };

  // 가격 정보 오버레이 콘텐츠 생성
  const createPriceOverlayContent = (place: PlaceWithMenu): string => {
    const menuList = place.menus
      .slice(0, 5) // 최대 5개만 표시
      .map(
        (menu) =>
          `<div style="padding: 2px 0; border-bottom: 1px solid #eee;">
            <span style="font-weight: 500;">${menu.name}</span>
            ${menu.price ? `<span style="color: #ff6b6b; margin-left: 8px;">${menu.price.toLocaleString()}원</span>` : '<span style="color: #999;">가격 정보 없음</span>'}
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #333;">
          ${place.name}
        </div>
        ${place.category ? `<div style="font-size: 11px; color: #666; margin-bottom: 8px;">${place.category}</div>` : ""}
        <div style="max-height: 200px; overflow-y: auto;">
          ${menuList || "<div style='color: #999;'>메뉴 정보 없음</div>"}
        </div>
        ${place.menus.length > 5 ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">외 ${place.menus.length - 5}개 메뉴</div>` : ""}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 11px; color: #666;">
          총 ${place.menu_count}개 메뉴
        </div>
      </div>
    `;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 카카오맵 컨테이너 */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* 선택된 장소 상세 정보 사이드바 */}
      {selectedPlace && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "300px",
            height: "100%",
            background: "white",
            boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
            padding: "20px",
            overflowY: "auto",
            zIndex: 10
          }}
        >
          <button
            onClick={() => setSelectedPlace(null)}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer"
            }}
          >
            ×
          </button>

          <h2 style={{ marginTop: 0 }}>{selectedPlace.name}</h2>
          {selectedPlace.category && (
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
              {selectedPlace.category}
            </div>
          )}
          {selectedPlace.address && (
            <div style={{ color: "#666", fontSize: "12px", marginBottom: "16px" }}>
              📍 {selectedPlace.address}
            </div>
          )}
          {selectedPlace.phone && (
            <div style={{ color: "#666", fontSize: "12px", marginBottom: "16px" }}>
              📞 {selectedPlace.phone}
            </div>
          )}

          <h3 style={{ marginTop: "24px", marginBottom: "12px" }}>메뉴 및 가격</h3>
          <div>
            {selectedPlace.menus.map((menu, index) => (
              <div
                key={index}
                style={{
                  padding: "12px",
                  marginBottom: "8px",
                  background: "#f8f9fa",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontWeight: 500 }}>{menu.name}</span>
                {menu.price ? (
                  <span style={{ color: "#ff6b6b", fontWeight: "bold" }}>
                    {menu.price.toLocaleString()}원
                  </span>
                ) : (
                  <span style={{ color: "#999" }}>가격 정보 없음</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 사용 예시

```typescript
// app/map/page.tsx
"use client";

import KakaoMapWithPrices from "@/components/KakaoMapWithPrices";

export default function MapPage() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <KakaoMapWithPrices
        centerLat={37.4980}
        centerLng={127.0276}
        radius={1000}
        apiBaseUrl="http://localhost:9001" // 또는 실제 배포 URL
      />
    </div>
  );
}
```

## 카카오맵 API와 좌표 매핑

### 좌표 매핑 전략

1. **DB 좌표 사용**: DB에 저장된 `lat`, `lng` 좌표를 직접 사용
2. **카카오맵 좌표 시스템**: 카카오맵은 WGS84 좌표계를 사용하므로 DB 좌표와 호환됨
3. **거리 계산**: 하버사인 공식 또는 간단한 유클리드 거리로 주변 장소 필터링

### 좌표 정확도

- 크롤링 시 카카오맵 API에서 받은 좌표를 그대로 저장하므로 정확도가 높음
- `lat`, `lng` 필드는 `Float` 타입으로 저장되어 소수점 6자리까지 정확

## 환경 변수 설정

프론트엔드 `.env.local` 파일:

```env
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_map_javascript_api_key
NEXT_PUBLIC_CRAWLER_API_URL=http://localhost:9001
```

## API 호출 최적화

### 1. 디바운싱

지도 이동 시 너무 많은 API 호출을 방지:

```typescript
import { useDebounce } from "@/hooks/useDebounce";

const debouncedCenter = useDebounce({ lat: centerLat, lng: centerLng }, 500);

useEffect(() => {
  if (!map) return;
  fetchPlacesWithPrices(debouncedCenter.lat, debouncedCenter.lng);
}, [debouncedCenter]);
```

### 2. 캐싱

같은 위치의 요청은 캐시 사용:

```typescript
const cache = new Map<string, PlaceWithMenu[]>();

const fetchPlacesWithPrices = async (lat: number, lng: number) => {
  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  // API 호출...
  cache.set(cacheKey, data);
  return data;
};
```

## 스타일링 예제

### 마커 커스터마이징

```typescript
// 가격 정보가 있는 장소는 빨간색 마커
const markerImageSrc = place.menu_count > 0 
  ? 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png'
  : 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker.png';

const imageSize = new window.kakao.maps.Size(24, 35);
const imageOption = { offset: new window.kakao.maps.Point(12, 35) };
const markerImage = new window.kakao.maps.MarkerImage(
  markerImageSrc,
  imageSize,
  imageOption
);

const marker = new window.kakao.maps.Marker({
  position: markerPosition,
  image: markerImage,
  map: kakaoMap
});
```

## 문제 해결

### 1. CORS 오류

크롤러 서비스의 CORS 설정 확인:
- `app/main.py`에서 CORS 미들웨어가 모든 origin을 허용하는지 확인

### 2. 좌표 불일치

- DB 좌표와 카카오맵 좌표가 다를 경우, 카카오맵 API로 좌표 변환:
  ```typescript
  const geocoder = new window.kakao.maps.services.Geocoder();
  geocoder.coord2Address(lng, lat, (result: any, status: any) => {
    // 좌표 검증 및 변환
  });
  ```

### 3. 마커가 표시되지 않음

- API 응답 확인: `console.log(data)`로 데이터 확인
- 좌표 범위 확인: `radius` 파라미터가 너무 작을 수 있음
- 지도 레벨 확인: 지도 레벨이 너무 높으면 마커가 겹칠 수 있음

## 추가 기능

### 실시간 가격 업데이트

```typescript
// 주기적으로 가격 정보 갱신
useEffect(() => {
  const interval = setInterval(() => {
    fetchPlacesWithPrices(centerLat, centerLng);
  }, 30000); // 30초마다 갱신

  return () => clearInterval(interval);
}, [centerLat, centerLng]);
```

### 가격 비교 기능

```typescript
// 같은 메뉴의 가격 비교
const comparePrices = (menuName: string) => {
  const prices = places
    .flatMap(place => 
      place.menus
        .filter(menu => menu.name === menuName)
        .map(menu => ({ place: place.name, price: menu.price }))
    )
    .filter(item => item.price !== null)
    .sort((a, b) => (a.price || 0) - (b.price || 0));
  
  return prices;
};
```

