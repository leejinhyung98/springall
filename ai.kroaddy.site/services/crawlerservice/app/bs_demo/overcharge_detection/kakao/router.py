# bs_demo/overcharge_detection/kakao/router.py
"""
카카오맵 크롤링 API 라우터
"""
import logging
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .search_kakao import search_kakao_places, fetch_kakao_place_detail
from .crawler import crawl_place_with_menu, crawl_and_save_to_db, save_place_to_db, batch_crawl_and_save_to_db
from .database import get_db
from .models import Place, Menu

logger = logging.getLogger(__name__)

# 카카오 전용 prefix
router = APIRouter(prefix="/kakao", tags=["카카오 지도 크롤링"])


class PlaceSearchRequest(BaseModel):
    place_name: str = Field(..., description="검색할 장소 이름", example="강남역 맛집")
    lat: Optional[float] = Field(None, description="위도 (선택사항)")
    lng: Optional[float] = Field(None, description="경도 (선택사항)")
    limit: int = Field(5, description="최대 검색 결과 개수", ge=1, le=20)
    save_to_db: bool = Field(False, description="DB에 저장 여부")


@router.get("/search", response_model=Dict)
async def kakao_search(
    place_name: str = Query(..., description="검색할 장소 이름", example="강남역 맛집"),
    lat: Optional[float] = Query(None, description="위도"),
    lng: Optional[float] = Query(None, description="경도"),
    radius: int = Query(1000, description="검색 반경(m)", ge=1, le=20000),
    limit: int = Query(5, description="최대 검색 결과 개수", ge=1, le=15),
):
    """카카오 로컬 검색 API로 place 목록 조회"""
    try:
        results = search_kakao_places(place_name, lat=lat, lng=lng, radius=radius, size=limit)
        return {"success": True, "data": results, "count": len(results)}
    except Exception as e:
        logger.error(f"카카오 검색 실패: {e}")
        raise HTTPException(status_code=500, detail=f"카카오 검색 중 오류: {str(e)}")


@router.get("/crawl/{place_id}", response_model=Dict)
async def kakao_crawl_by_id(place_id: str):
    """카카오 place_id로 기본정보+메뉴 추출"""
    try:
        result = fetch_kakao_place_detail(place_id)
        if not result:
            raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")
        return {"success": True, "data": result, "menu_count": len(result.get("menus", []))}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"카카오 크롤링 실패 ({place_id}): {e}")
        raise HTTPException(status_code=500, detail=f"카카오 크롤링 중 오류: {str(e)}")


@router.get("/search-and-crawl", response_model=Dict)
async def kakao_search_and_crawl(
    place_name: str = Query(..., description="검색할 장소 이름", example="강남역 맛집"),
    lat: Optional[float] = Query(None, description="위도"),
    lng: Optional[float] = Query(None, description="경도"),
    radius: int = Query(1000, description="검색 반경(m)", ge=1, le=20000),
    limit: int = Query(5, description="최대 검색 및 크롤링 결과 개수", ge=1, le=10),
    save_to_db: bool = Query(False, description="DB에 저장 여부"),
    db: Session = Depends(get_db)
):
    """
    카카오 검색과 크롤링을 한 번에 처리
    검색 결과를 모두 크롤링하여 메뉴 가격 정보까지 포함하여 반환
    save_to_db=True로 설정하면 결과를 Neon DB에 저장
    """
    try:
        results = crawl_place_with_menu(
            place_name=place_name,
            lat=lat,
            lng=lng,
            limit=limit,
            auto_select=False  # 모든 결과 크롤링
        )
        
        total_menus = sum(len(r.get("menus", [])) for r in results)
        
        # DB 저장 옵션이 활성화된 경우
        saved_places = []
        if save_to_db and results:
            saved_places = batch_crawl_and_save_to_db(
                db=db,
                place_name=place_name,
                lat=lat,
                lng=lng,
                limit=limit
            )
            
            # 저장된 장소 정보를 결과에 추가
            for i, result in enumerate(results):
                saved_place = next((p for p in saved_places if p.kakao_place_id == result.get("kakao_place_id")), None)
                if saved_place:
                    result["db_id"] = saved_place.id
                    result["saved"] = True
                else:
                    result["saved"] = False
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "total_menu_count": total_menus,
            "saved_to_db": save_to_db,
            "saved_count": len(saved_places) if save_to_db else 0,
            "message": f"{len(results)}개 장소의 메뉴 정보를 크롤링했습니다." + 
                      (f" {len(saved_places)}개 장소를 DB에 저장했습니다." if save_to_db else "")
        }
    except Exception as e:
        logger.error(f"카카오 통합 크롤링 실패: {e}")
        raise HTTPException(status_code=500, detail=f"카카오 크롤링 중 오류: {str(e)}")


@router.post("/crawl", response_model=Dict)
async def kakao_crawl_by_name(
    request: PlaceSearchRequest,
    db: Session = Depends(get_db)
):
    """
    카카오에서 키워드 검색 후 모든 결과의 메뉴/가격까지 추출
    save_to_db=True로 설정하면 결과를 Neon DB에 저장
    """
    try:
        results = crawl_place_with_menu(
            place_name=request.place_name,
            lat=request.lat,
            lng=request.lng,
            limit=request.limit,
            auto_select=False  # 모든 결과 크롤링
        )
        
        if not results:
            return {"success": True, "data": [], "count": 0, "total_menu_count": 0}
        
        total_menus = sum(len(r.get("menus", [])) for r in results)
        
        # DB 저장 옵션이 활성화된 경우
        saved_places = []
        if request.save_to_db:
            saved_places = batch_crawl_and_save_to_db(
                db=db,
                place_name=request.place_name,
                lat=request.lat,
                lng=request.lng,
                limit=request.limit
            )
            
            # 저장된 장소 정보를 결과에 추가
            for result in results:
                saved_place = next((p for p in saved_places if p.kakao_place_id == result.get("kakao_place_id")), None)
                if saved_place:
                    result["db_id"] = saved_place.id
                    result["saved"] = True
                else:
                    result["saved"] = False
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "total_menu_count": total_menus,
            "saved_to_db": request.save_to_db,
            "saved_count": len(saved_places) if request.save_to_db else 0,
            "message": f"{len(results)}개 장소의 메뉴 정보를 크롤링했습니다." + 
                      (f" {len(saved_places)}개 장소를 DB에 저장했습니다." if request.save_to_db else "")
        }
    except Exception as e:
        logger.error(f"카카오 통합 크롤링 실패: {e}")
        raise HTTPException(status_code=500, detail=f"카카오 크롤링 중 오류: {str(e)}")


@router.get("/menu/{place_id}", response_model=Dict)
async def kakao_menu_only(place_id: str):
    """카카오 place_id로 메뉴만 추출"""
    try:
        detail = fetch_kakao_place_detail(place_id)
        return {
            "success": True,
            "data": {"kakao_place_id": place_id, "menus": detail.get("menus", [])},
            "menu_count": len(detail.get("menus", [])),
        }
    except Exception as e:
        logger.error(f"카카오 메뉴 추출 실패 ({place_id}): {e}")
        raise HTTPException(status_code=500, detail=f"카카오 메뉴 추출 중 오류: {str(e)}")


@router.post("/crawl-and-save", response_model=Dict)
async def kakao_crawl_and_save(
    request: PlaceSearchRequest,
    db: Session = Depends(get_db)
):
    """크롤링 후 DB에 저장 (중복 체크 포함)"""
    try:
        place = crawl_and_save_to_db(
            db=db,
            place_name=request.place_name,
            lat=request.lat,
            lng=request.lng,
            auto_select=True
        )
        
        if not place:
            raise HTTPException(status_code=404, detail="장소를 찾을 수 없거나 저장에 실패했습니다.")
        
        # 저장된 메뉴 정보 포함하여 반환
        menus = [{"name": m.menu_name, "price": m.price} for m in place.menus]
        
        return {
            "success": True,
            "data": {
                "id": place.id,
                "kakao_place_id": place.kakao_place_id,
                "name": place.name,
                "address": place.address,
                "lat": place.lat,
                "lng": place.lng,
                "phone": place.phone,
                "category": place.category,
                "menus": menus
            },
            "menu_count": len(menus),
            "message": "DB에 저장되었습니다."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"크롤링 및 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=f"크롤링 및 저장 중 오류: {str(e)}")


@router.get("/places/nearby", response_model=Dict)
async def get_places_nearby(
    lat: float = Query(..., description="위도"),
    lng: float = Query(..., description="경도"),
    radius: float = Query(1000, description="반경(m)", ge=100, le=5000),
    db: Session = Depends(get_db)
):
    """좌표 기반으로 주변 장소의 가격 정보 조회"""
    try:
        # 간단한 거리 계산 (하버사인 공식 대신 사각형 범위 사용)
        # 1도 ≈ 111km, 따라서 radius/111000 정도의 범위
        lat_range = radius / 111000
        lng_range = radius / (111000 * abs(lat / 90)) if lat != 0 else radius / 111000
        
        places = db.query(Place).filter(
            Place.lat.between(lat - lat_range, lat + lat_range),
            Place.lng.between(lng - lng_range, lng + lng_range)
        ).all()
        
        results = []
        for place in places:
            menus = [{"name": m.menu_name, "price": m.price} for m in place.menus]
            results.append({
                "id": place.id,
                "kakao_place_id": place.kakao_place_id,
                "name": place.name,
                "address": place.address,
                "lat": place.lat,
                "lng": place.lng,
                "phone": place.phone,
                "category": place.category,
                "menus": menus,
                "menu_count": len(menus)
            })
        
        return {
            "success": True,
            "data": results,
            "count": len(results),
            "center": {"lat": lat, "lng": lng},
            "radius": radius
        }
    except Exception as e:
        logger.error(f"주변 장소 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"주변 장소 조회 중 오류: {str(e)}")


@router.get("/places/{place_id}", response_model=Dict)
async def get_place_by_id(
    place_id: int,
    db: Session = Depends(get_db)
):
    """DB에서 장소 정보 조회"""
    try:
        place = db.query(Place).filter(Place.id == place_id).first()
        
        if not place:
            raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")
        
        menus = [{"name": m.menu_name, "price": m.price} for m in place.menus]
        
        return {
            "success": True,
            "data": {
                "id": place.id,
                "kakao_place_id": place.kakao_place_id,
                "name": place.name,
                "address": place.address,
                "lat": place.lat,
                "lng": place.lng,
                "phone": place.phone,
                "category": place.category,
                "menus": menus,
                "created_at": place.created_at.isoformat() if place.created_at else None,
                "updated_at": place.updated_at.isoformat() if place.updated_at else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"장소 조회 실패 ({place_id}): {e}")
        raise HTTPException(status_code=500, detail=f"장소 조회 중 오류: {str(e)}")

