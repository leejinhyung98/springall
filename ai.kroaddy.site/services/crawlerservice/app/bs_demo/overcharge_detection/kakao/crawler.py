# bs_demo/kakao/crawler.py
"""
카카오맵 API를 사용한 통합 크롤링 모듈
장소 검색부터 메뉴 가격 추출까지 처리
"""
from typing import List, Dict, Optional
import logging
from sqlalchemy.orm import Session
from .search_kakao import search_kakao_places, fetch_kakao_place_detail
from .models import Place, Menu

logger = logging.getLogger(__name__)


def crawl_place_with_menu(
    place_name: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = 5,
    auto_select: bool = True
) -> List[Dict]:
    """
    장소 이름으로 검색하고 메뉴 정보까지 추출하는 통합 크롤링 함수
    
    Args:
        place_name: 검색할 장소 이름
        lat: 위도 (선택사항)
        lng: 경도 (선택사항)
        limit: 최대 검색 결과 개수
        auto_select: True면 첫 번째 결과 자동 선택, False면 모든 결과 반환
    
    Returns:
        장소 및 메뉴 정보 리스트 [{
            "kakao_place_id": str,
            "name": str,
            "address": str,
            "lat": float,
            "lng": float,
            "category": str,
            "phone": str,
            "menus": List[Dict]  # [{"name": str, "price": int}]
        }]
    """
    try:
        # 1. 장소 검색
        logger.info(f"카카오맵에서 '{place_name}' 검색 중...")
        places = search_kakao_places(place_name, lat=lat, lng=lng, size=limit)
        
        if not places:
            logger.warning(f"'{place_name}' 검색 결과 없음")
            return []
        
        # 2. auto_select가 True면 첫 번째 결과만 처리
        if auto_select:
            places = places[:1]
        
        # 3. 각 장소의 메뉴 정보 추출
        results = []
        for place in places:
            try:
                place_id = place.get("kakao_place_id")
                if not place_id:
                    continue
                
                logger.info(f"장소 상세 정보 및 메뉴 추출 중: {place.get('name')} ({place_id})")
                
                # 메뉴 정보 추출
                detail_data = fetch_kakao_place_detail(place_id)
                
                # 결과 통합
                result = {
                    **place,
                    "menus": detail_data.get("menus", [])
                }
                
                results.append(result)
                
                logger.info(f"완료: {place.get('name')} -> {len(result['menus'])}개 메뉴")
                
            except Exception as e:
                logger.error(f"장소 메뉴 추출 실패 ({place.get('name')}): {e}")
                # 메뉴 추출 실패해도 기본 정보는 포함
                results.append({
                    **place,
                    "menus": []
                })
        
        logger.info(f"크롤링 완료: {len(results)}개 장소 처리")
        return results
        
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}")
        return []


def crawl_place_by_id(kakao_place_id: str) -> Optional[Dict]:
    """
    카카오 place ID로 직접 크롤링
    
    Args:
        kakao_place_id: 카카오 place ID
    
    Returns:
        장소 및 메뉴 정보 딕셔너리
    """
    try:
        # 메뉴 정보 추출
        detail_data = fetch_kakao_place_detail(kakao_place_id)
        
        logger.info(f"크롤링 완료: {kakao_place_id} -> {len(detail_data.get('menus', []))}개 메뉴")
        return detail_data
        
    except Exception as e:
        logger.error(f"크롤링 실패 ({kakao_place_id}): {e}")
        return None


def batch_crawl_places(place_names: List[str]) -> List[Dict]:
    """
    여러 장소를 일괄 크롤링
    
    Args:
        place_names: 장소 이름 리스트
    
    Returns:
        모든 장소의 크롤링 결과 리스트
    """
    all_results = []
    
    for place_name in place_names:
        try:
            results = crawl_place_with_menu(place_name, auto_select=True)
            all_results.extend(results)
        except Exception as e:
            logger.error(f"일괄 크롤링 중 오류 ({place_name}): {e}")
            continue
    
    logger.info(f"일괄 크롤링 완료: {len(all_results)}개 장소")
    return all_results


def save_place_to_db(db: Session, place_data: Dict) -> Optional[Place]:
    """
    크롤링한 장소 정보를 DB에 저장 (중복 체크 포함)
    
    Args:
        db: 데이터베이스 세션
        place_data: 장소 정보 딕셔너리 {
            "kakao_place_id": str,
            "name": str,
            "address": str,
            "lat": float,
            "lng": float,
            "phone": str,
            "category": str,
            "menus": List[Dict]  # [{"name": str, "price": int}]
        }
    
    Returns:
        저장된 Place 객체 또는 None
    """
    try:
        kakao_place_id = place_data.get("kakao_place_id")
        if not kakao_place_id:
            logger.warning("kakao_place_id가 없어 저장할 수 없습니다")
            return None
        
        # 기존 장소 확인
        existing_place = db.query(Place).filter(
            Place.kakao_place_id == kakao_place_id
        ).first()
        
        if existing_place:
            # 기존 장소 업데이트
            place = existing_place
            place.name = place_data.get("name", place.name)
            place.address = place_data.get("address", place.address)
            place.lat = place_data.get("lat", place.lat)
            place.lng = place_data.get("lng", place.lng)
            place.phone = place_data.get("phone", place.phone)
            place.category = place_data.get("category", place.category)
            logger.info(f"기존 장소 업데이트: {kakao_place_id}")
        else:
            # 새 장소 생성
            place = Place(
                kakao_place_id=kakao_place_id,
                name=place_data.get("name", ""),
                address=place_data.get("address"),
                lat=place_data.get("lat", 0.0),
                lng=place_data.get("lng", 0.0),
                phone=place_data.get("phone"),
                category=place_data.get("category")
            )
            db.add(place)
            db.flush()  # ID를 얻기 위해 flush
            logger.info(f"새 장소 저장: {kakao_place_id}")
        
        # 메뉴 정보 저장 (중복 체크)
        menus_data = place_data.get("menus", [])
        saved_menu_count = 0
        
        for menu_data in menus_data:
            menu_name = menu_data.get("name", "").strip()
            if not menu_name:
                continue
            
            # 기존 메뉴 확인 (place_id + menu_name 조합으로 중복 체크)
            existing_menu = db.query(Menu).filter(
                Menu.place_id == place.id,
                Menu.menu_name == menu_name
            ).first()
            
            if existing_menu:
                # 기존 메뉴 가격 업데이트
                existing_menu.price = menu_data.get("price")
                logger.debug(f"메뉴 가격 업데이트: {menu_name}")
            else:
                # 새 메뉴 추가
                new_menu = Menu(
                    place_id=place.id,
                    menu_name=menu_name,
                    price=menu_data.get("price")
                )
                db.add(new_menu)
                saved_menu_count += 1
                logger.debug(f"새 메뉴 저장: {menu_name}")
        
        db.commit()
        logger.info(f"장소 저장 완료: {place.name} ({kakao_place_id}) - {saved_menu_count}개 새 메뉴 추가")
        return place
        
    except Exception as e:
        db.rollback()
        logger.error(f"DB 저장 실패 ({place_data.get('kakao_place_id')}): {e}")
        return None


def crawl_and_save_to_db(
    db: Session,
    place_name: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    auto_select: bool = True
) -> Optional[Place]:
    """
    크롤링 후 DB에 저장하는 통합 함수
    
    Args:
        db: 데이터베이스 세션
        place_name: 검색할 장소 이름
        lat: 위도 (선택사항)
        lng: 경도 (선택사항)
        auto_select: True면 첫 번째 결과만 저장
    
    Returns:
        저장된 Place 객체 또는 None
    """
    try:
        # 크롤링
        results = crawl_place_with_menu(
            place_name=place_name,
            lat=lat,
            lng=lng,
            limit=1 if auto_select else 5,
            auto_select=auto_select
        )
        
        if not results:
            logger.warning(f"'{place_name}' 크롤링 결과 없음")
            return None
        
        # 첫 번째 결과 저장
        place = save_place_to_db(db, results[0])
        return place
        
    except Exception as e:
        logger.error(f"크롤링 및 저장 실패 ({place_name}): {e}")
        return None


def batch_crawl_and_save_to_db(
    db: Session,
    place_name: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = 5
) -> List[Place]:
    """
    여러 장소를 크롤링하고 모두 DB에 저장하는 함수
    
    Args:
        db: 데이터베이스 세션
        place_name: 검색할 장소 이름
        lat: 위도 (선택사항)
        lng: 경도 (선택사항)
        limit: 최대 검색 및 저장 결과 개수
    
    Returns:
        저장된 Place 객체 리스트
    """
    try:
        # 크롤링
        results = crawl_place_with_menu(
            place_name=place_name,
            lat=lat,
            lng=lng,
            limit=limit,
            auto_select=False  # 모든 결과 크롤링
        )
        
        if not results:
            logger.warning(f"'{place_name}' 크롤링 결과 없음")
            return []
        
        # 모든 결과 저장
        saved_places = []
        for result in results:
            place = save_place_to_db(db, result)
            if place:
                saved_places.append(place)
        
        logger.info(f"총 {len(saved_places)}개 장소 저장 완료")
        return saved_places
        
    except Exception as e:
        logger.error(f"배치 크롤링 및 저장 실패 ({place_name}): {e}")
        return []

