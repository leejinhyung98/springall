/**
 * 크롤러 서비스 API 호출 함수
 * Neon DB에 저장된 크롤링 데이터를 조회
 */

import { Menu, PlaceWithMenu } from "./types";

// 크롤러 서비스 URL (환경 변수 또는 기본값)
const CRAWLER_API_BASE_URL = process.env.NEXT_PUBLIC_CRAWLER_API_URL || "http://localhost:9001";

export interface PlacesNearbyResponse {
  success: boolean;
  data: PlaceWithMenu[];
  count: number;
  center: { lat: number; lng: number };
  radius: number;
}

/**
 * 주변 장소의 가격 정보 조회
 * @param lat 위도
 * @param lng 경도
 * @param radius 반경 (미터 단위, 기본값: 1000)
 * @returns 주변 장소 목록과 메뉴 가격 정보
 */
export async function fetchPlacesWithPrices(
  lat: number,
  lng: number,
  radius: number = 1000
): Promise<PlaceWithMenu[]> {
  try {
    const response = await fetch(
      `${CRAWLER_API_BASE_URL}/kakao/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    );

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data: PlacesNearbyResponse = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return [];
  } catch (error) {
    console.error("주변 장소 가격 정보 조회 실패:", error);
    return [];
  }
}

/**
 * 장소 ID로 상세 정보 조회
 * @param placeId DB의 장소 ID
 * @returns 장소 상세 정보
 */
export async function fetchPlaceById(placeId: number): Promise<PlaceWithMenu | null> {
  try {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/kakao/places/${placeId}`);

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error("장소 정보 조회 실패:", error);
    return null;
  }
}

