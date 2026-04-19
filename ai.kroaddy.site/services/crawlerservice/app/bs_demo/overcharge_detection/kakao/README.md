# 카카오맵 가격 크롤링 및 DB 저장 시스템

## 개요

카카오맵에서 장소 정보와 메뉴 가격을 크롤링하여 Neon DB에 저장하고, 좌표 기반으로 가격 정보를 조회할 수 있는 시스템입니다.

## 주요 기능

1. **크롤링**: 카카오맵에서 장소 검색 및 메뉴 가격 추출
2. **DB 저장**: 중복 체크를 통한 효율적인 데이터 저장
3. **좌표 기반 조회**: 위도/경도 기반 주변 장소 가격 정보 조회
4. **프론트엔드 연동**: 카카오맵 API와 연동하여 가격 정보 표시

## 데이터베이스 설정

### 1. 환경 변수 설정

`.env` 파일에 Neon DB URL 추가:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
```

### 2. 데이터베이스 테이블 초기화

```bash
cd ai.kroaddy.site/services/crawlerservice
python -m app.bs_demo.overcharge_detection.kakao.init_db
```

또는 Python에서:

```python
from app.bs_demo.overcharge_detection.kakao.init_db import init_db
init_db()
```

## API 엔드포인트

### 1. 크롤링 및 DB 저장

```http
POST /kakao/crawl-and-save
Content-Type: application/json

{
  "place_name": "강남역 맛집",
  "lat": 37.4980,
  "lng": 127.0276,
  "limit": 5
}
```

**응답:**
```json
{
  "success": true,
  "data": {
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
    ]
  },
  "menu_count": 2,
  "message": "DB에 저장되었습니다."
}
```

### 2. 좌표 기반 주변 장소 조회

```http
GET /kakao/places/nearby?lat=37.4980&lng=127.0276&radius=1000
```

**응답:**
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

### 3. 장소 ID로 조회

```http
GET /kakao/places/{place_id}
```

## 중복 방지 로직

1. **장소 중복**: `kakao_place_id`를 기준으로 중복 체크
   - 기존 장소가 있으면 업데이트
   - 없으면 새로 생성

2. **메뉴 중복**: `place_id + menu_name` 조합으로 중복 체크
   - 같은 장소의 같은 메뉴명이 있으면 가격만 업데이트
   - 없으면 새로 추가

## 프론트엔드 연동 가이드

### 1. 카카오맵 API와 연동

```typescript
// 프론트엔드 예시 (TypeScript/React)

// 1. 카카오맵에서 장소 클릭 시
const handlePlaceClick = async (place: kakao.maps.services.PlacesSearchResultItem) => {
  const { y: lat, x: lng } = place;
  
  // 2. 주변 장소 가격 정보 조회
  const response = await fetch(
    `https://your-api-domain.com/kakao/places/nearby?lat=${lat}&lng=${lng}&radius=500`
  );
  const data = await response.json();
  
  // 3. 카카오맵 마커에 가격 정보 표시
  if (data.success && data.data.length > 0) {
    data.data.forEach((place: any) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(place.lat, place.lng),
        map: map
      });
      
      // 커스텀 오버레이로 가격 정보 표시
      const content = `
        <div class="price-info">
          <h3>${place.name}</h3>
          <ul>
            ${place.menus.map((menu: any) => 
              `<li>${menu.name}: ${menu.price?.toLocaleString()}원</li>`
            ).join('')}
          </ul>
        </div>
      `;
      
      const overlay = new kakao.maps.CustomOverlay({
        content: content,
        position: marker.getPosition()
      });
      
      kakao.maps.event.addListener(marker, 'click', () => {
        overlay.setMap(map);
      });
    });
  }
};
```

### 2. 크롤링 요청 (새 장소 추가)

```typescript
const crawlAndSavePlace = async (placeName: string, lat: number, lng: number) => {
  const response = await fetch('https://your-api-domain.com/kakao/crawl-and-save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      place_name: placeName,
      lat: lat,
      lng: lng,
      limit: 1
    })
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('저장 완료:', data.data);
    // 지도에 새 마커 추가
  }
};
```

## 사용 예시

### Python에서 직접 사용

```python
from app.bs_demo.overcharge_detection.kakao.crawler import crawl_and_save_to_db
from app.bs_demo.overcharge_detection.kakao.database import SessionLocal

# DB 세션 생성
db = SessionLocal()

# 크롤링 및 저장
place = crawl_and_save_to_db(
    db=db,
    place_name="강남역 맛집",
    lat=37.4980,
    lng=127.0276,
    auto_select=True
)

if place:
    print(f"저장 완료: {place.name}")
    print(f"메뉴 개수: {len(place.menus)}")

db.close()
```

## 데이터베이스 스키마

### kakao_places 테이블
- `id`: Primary Key
- `kakao_place_id`: 카카오 place ID (Unique)
- `name`: 장소 이름
- `address`: 주소
- `lat`: 위도
- `lng`: 경도
- `phone`: 전화번호
- `category`: 카테고리
- `created_at`: 생성 시간
- `updated_at`: 업데이트 시간

### kakao_menus 테이블
- `id`: Primary Key
- `place_id`: Foreign Key (kakao_places.id)
- `menu_name`: 메뉴 이름
- `price`: 가격 (원)
- `created_at`: 생성 시간
- `updated_at`: 업데이트 시간
- Unique Constraint: `(place_id, menu_name)`

## 주의사항

1. **API 키 설정**: `KAKAO_REST_API_KEY` 환경 변수 필수
2. **DB 연결**: Neon DB URL이 올바르게 설정되어 있어야 함
3. **중복 체크**: 같은 장소의 같은 메뉴는 가격만 업데이트됨
4. **좌표 범위**: 주변 조회 시 반경은 100m~5000m 권장

