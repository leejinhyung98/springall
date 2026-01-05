# 카카오맵 가격 정보 표시 기능 설정 가이드

## 개요

Neon DB에 저장된 크롤링 데이터를 카카오맵에 표시하여 메뉴와 가격 정보를 확인할 수 있는 기능입니다.

## 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# 카카오맵 JavaScript API 키
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your_kakao_map_javascript_api_key

# 크롤러 서비스 URL (로컬 개발 시)
NEXT_PUBLIC_CRAWLER_API_URL=http://localhost:9001

# 프로덕션 환경에서는 실제 배포 URL 사용
# NEXT_PUBLIC_CRAWLER_API_URL=https://your-crawler-service-url.com
```

## 기능 설명

### 1. 자동 가격 정보 표시
- 지도 중심이 변경되면 자동으로 주변 장소의 가격 정보를 조회
- 가격 정보가 있는 장소는 빨간색 마커로 표시
- 마커 클릭 시 메뉴와 가격 정보가 오버레이로 표시

### 2. 가격 정보 토글 버튼
- 좌측 하단에 "가격 정보 표시/숨기기" 버튼 추가
- 버튼 클릭으로 가격 정보 마커 표시/숨김 제어

### 3. API 엔드포인트
- `/kakao/places/nearby`: 주변 장소 가격 정보 조회
- 자동으로 1km 반경 내의 장소를 조회

## 사용 방법

1. **환경 변수 설정**: `.env.local` 파일에 크롤러 서비스 URL 설정
2. **크롤러 서비스 실행**: `http://localhost:9001`에서 크롤러 서비스가 실행 중이어야 함
3. **지도 사용**: 카카오맵에서 지도를 이동하면 자동으로 주변 가격 정보가 표시됨

## 문제 해결

### 1. 가격 정보가 표시되지 않음
- 크롤러 서비스가 실행 중인지 확인
- `.env.local`의 `NEXT_PUBLIC_CRAWLER_API_URL`이 올바른지 확인
- 브라우저 콘솔에서 API 호출 오류 확인

### 2. CORS 오류
- 크롤러 서비스의 CORS 설정 확인 (`app/main.py`)
- 모든 origin을 허용하도록 설정되어 있는지 확인

### 3. 마커가 표시되지 않음
- 해당 위치에 크롤링된 데이터가 DB에 있는지 확인
- `/kakao/places/nearby` API를 직접 호출하여 데이터 확인

## 추가 기능

### 가격 정보 표시 범위 조정
`KakaoMap.tsx`의 `displayPriceMarkers` 함수에서 `radius` 파라미터를 조정할 수 있습니다:

```typescript
displayPriceMarkers(map, lat, lng, 2000); // 2km 반경
```

### 마커 스타일 커스터마이징
`displayPriceMarkers` 함수에서 마커 이미지를 변경할 수 있습니다:

```typescript
const markerImageSrc = '/img/marker-red.png'; // 빨간색 마커
```

