// lib/types.ts
export interface Location {
  id: string;
  name: string;
  address: string;
  phone?: string;
  category?: string;
  lat: number;
  lng: number;
  placeUrl?: string;
  imageUrl?: string;
  order?: number; // 경로 순서 (작을수록 먼저 방문)
}

// 여행 일정 전체
export interface TravelPlan {
  id?: string;
  title: string;
  description?: string;
  locations: Location[];
  createdAt?: string;
}

// 메시지 타입
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  translatedContent?: string; // 번역된 내용
}

// 언어 타입
export type LanguageCode =
  | 'ko' // 한국어
  | 'en' // 영어
  | 'ja' // 일본어
  | 'zh-CN' // 중국어 간체
  | 'zh-TW' // 중국어 번체
  | 'fr' // 프랑스어
  | 'de' // 독일어
  | 'vi' // 베트남어
  | 'it' // 이탈리아어
  | 'ar' // 아랍어
  | 'id' // 인도네시아어
  | 'th' // 태국어
  | 'mn' // 몽골어
  | 'pt' // 포르투갈어
  | 'es' // 스페인어
  | 'uz' // 우즈베크어
  | 'km' // 크메르어
  | 'ne'; // 네팔어

export interface Language {
  code: LanguageCode;
  name: string;
  native: string;
  country: string;
}

// 번역 요청/응답 타입
export interface TranslateRequest {
  text: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}

export interface TranslateResponse {
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}

// 크롤러 서비스에서 가져온 가격 정보 타입
export interface Menu {
  name: string;
  price: number | null;
}

export interface PlaceWithMenu {
  id: number;
  kakao_place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  category?: string;
  menus: Menu[];
  menu_count: number;
}