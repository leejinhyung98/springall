"""
카카오맵 장소 검색 및 상세/메뉴 추출
"""
import os
import re
import json
import logging
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict, Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# .env 파일 자동 로드 (프로젝트 루트에서 찾기)
current_dir = Path(__file__).resolve()
env_loaded = False

# 최대 10단계까지 상위 디렉토리 탐색
for i in range(10):
    try:
        env_file = current_dir.parents[i] / ".env"
        if env_file.exists():
            load_dotenv(env_file, override=False)
            env_loaded = True
            break
    except IndexError:
        break

# 현재 작업 디렉토리에서도 시도
if not env_loaded:
    cwd_env = Path.cwd() / ".env"
    if cwd_env.exists():
        load_dotenv(cwd_env, override=False)
        env_loaded = True

# 프로젝트 루트 추정 (현재 파일에서 7단계 위: kroaddy_project_dacon_test/)
if not env_loaded:
    try:
        project_root_env = current_dir.parents[7] / ".env"
        if project_root_env.exists():
            load_dotenv(project_root_env, override=False)
            env_loaded = True
    except IndexError:
        pass

logger = logging.getLogger(__name__)
# uvicorn 기본 로거 설정에 종속되지만, 이 모듈 로그는 INFO 이상은 항상 보이도록 레벨을 명시
if logger.level == logging.NOTSET:
    logger.setLevel(logging.INFO)

KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "")
KAKAO_SEARCH_API = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_PLACE_URL = "https://place.map.kakao.com/{place_id}"
# 비공식 v6 / legacy 메뉴 API (Selenium 이전에 우선 시도)
KAKAO_V6_DETAIL_API = "https://place.map.kakao.com/api/v6/places/{place_id}"
KAKAO_V6_MENU_API = "https://place.map.kakao.com/api/v6/places/{place_id}/menu"
KAKAO_LEGACY_DETAIL_API = "https://place.map.kakao.com/main/v/{place_id}"
KAKAO_LEGACY_MENU_API = "https://place.map.kakao.com/menu/v/{place_id}"


def search_kakao_places(
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: int = 1000,
    size: int = 5,
) -> List[Dict]:
    """
    카카오 키워드 검색으로 place 목록 반환
    """
    if not KAKAO_REST_API_KEY:
        logger.error("KAKAO_REST_API_KEY 미설정")
        return []

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {
        "query": query,
        "size": size,
    }
    # 좌표가 있으면 거리 기반 검색
    if lat and lng:
        params.update({"x": lng, "y": lat, "radius": radius})

    try:
        resp = requests.get(KAKAO_SEARCH_API, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        docs = data.get("documents", [])
        results = []
        for doc in docs:
            results.append(
                {
                    "kakao_place_id": doc.get("id", ""),
                    "name": doc.get("place_name", ""),
                    "address": doc.get("road_address_name")
                    or doc.get("address_name")
                    or "",
                    "lat": float(doc.get("y", 0)) if doc.get("y") else None,
                    "lng": float(doc.get("x", 0)) if doc.get("x") else None,
                    "phone": doc.get("phone", ""),
                    "category": doc.get("category_name", ""),
                    "distance_m": float(doc.get("distance", 0)) if doc.get("distance") else None,
                }
            )
        return results
    except Exception as e:
        logger.error(f"카카오 검색 실패: {e}")
        return []


def fetch_kakao_place_detail(place_id: str) -> Dict:
    """
    카카오 place 상세/메뉴 정보를 여러 방법으로 시도해서 가져온다.

    1) 비공식 v6 메뉴 API (`/api/v6/places/{id}/menu`)
    2) 구버전 JSON API (`/main/v/{id}`, `/menu/v/{id}`)
    3) HTML 내 `__INITIAL_STATE__` JSON 블록 파싱
    4) Selenium 으로 DOM 직접 파싱 (최종 폴백)
    """
    logger.info(f"카카오 상세 메뉴 조회 시작: {place_id}")
    menus: List[Dict] = []

    # 1) v6 메뉴 API
    try:
        menus = _fetch_kakao_menu_v6_api(place_id)
        if menus:
            logger.info(f"카카오 v6 메뉴 API 성공: {place_id} -> {len(menus)}개")
            return {"kakao_place_id": place_id, "menus": menus}
    except Exception as e:
        logger.warning(f"카카오 v6 메뉴 API 실패 ({place_id}): {e}")

    # 2) 구버전 JSON API
    try:
        menus = _fetch_kakao_menu_legacy_api(place_id)
        if menus:
            logger.info(f"카카오 legacy 메뉴 API 성공: {place_id} -> {len(menus)}개")
            return {"kakao_place_id": place_id, "menus": menus}
    except Exception as e:
        logger.warning(f"카카오 legacy 메뉴 API 실패 ({place_id}): {e}")

    # 3) HTML 내 __INITIAL_STATE__ JSON 파싱
    try:
        menus = _fetch_kakao_menu_from_initial_state(place_id)
        if menus:
            logger.info(
                f"카카오 __INITIAL_STATE__ 메뉴 파싱 성공: {place_id} -> {len(menus)}개"
            )
            return {"kakao_place_id": place_id, "menus": menus}
    except Exception as e:
        logger.warning(f"카카오 __INITIAL_STATE__ 메뉴 파싱 실패 ({place_id}): {e}")

    # 4) Selenium 폴백
    try:
        logger.info(f"카카오 Selenium 메뉴 파싱 시도: {place_id}")
        menus = _fetch_kakao_menu_selenium(place_id)
        if menus:
            logger.info(f"카카오 Selenium 메뉴 파싱 완료: {place_id} -> {len(menus)}개")
        else:
            logger.warning(f"카카오 Selenium 메뉴 파싱 결과 0개 ({place_id})")
    except Exception as e:
        logger.error(f"카카오 Selenium 메뉴 파싱 실패 ({place_id}): {e}")
        menus = []

    return {"kakao_place_id": place_id, "menus": menus}


def _normalize_menu_item(name: Optional[str], price: Optional[str]) -> Optional[Dict]:
    """공통 메뉴 아이템 정규화 helper"""
    if not name:
        return None
    price_int: Optional[int] = None
    if price:
        digits = re.sub(r"[^0-9]", "", str(price))
        if digits:
            try:
                price_int = int(digits)
            except Exception:
                price_int = None
    return {"name": name.strip(), "price": price_int}


def _fetch_kakao_menu_v6_api(place_id: str) -> List[Dict]:
    """비공식 v6 메뉴 API 호출"""
    url = KAKAO_V6_MENU_API.format(place_id=place_id)
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": KAKAO_PLACE_URL.format(place_id=place_id),
    }
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"status={resp.status_code}")
    data = resp.json()

    menus: List[Dict] = []
    # 구조가 빈번히 바뀔 수 있으므로 여러 후보 경로를 시도
    candidates = []
    if isinstance(data, dict):
        candidates.append(data.get("menuInfo", {}).get("menuList"))
        candidates.append(data.get("menu", []))
        candidates.append(data.get("menus"))

    for lst in candidates:
        if not lst or not isinstance(lst, list):
            continue
        for item in lst:
            if not isinstance(item, dict):
                continue
            name = item.get("menu") or item.get("name") or item.get("menu_name")
            price = item.get("price") or item.get("priceDesc") or item.get(
                "price_desc"
            )
            norm = _normalize_menu_item(name, price)
            if norm:
                menus.append(norm)
        if menus:
            break

    return menus


def _fetch_kakao_menu_legacy_api(place_id: str) -> List[Dict]:
    """구버전 JSON API(main/menu) 기반 파싱"""
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": KAKAO_PLACE_URL.format(place_id=place_id),
    }

    # /menu/v/{id} 우선
    url_menu = KAKAO_LEGACY_MENU_API.format(place_id=place_id)
    resp = requests.get(url_menu, headers=headers, timeout=10)
    menus: List[Dict] = []
    if resp.status_code == 200:
        try:
            data = resp.json()
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            lst = data.get("menu", []) or data.get("menuList") or data.get("menus")
            if isinstance(lst, list):
                for item in lst:
                    if not isinstance(item, dict):
                        continue
                    name = item.get("name") or item.get("menu")
                    price = item.get("price") or item.get("price_desc")
                    norm = _normalize_menu_item(name, price)
                    if norm:
                        menus.append(norm)
    if menus:
        return menus

    # 필요 시 /main/v/{id}에서도 추가 정보 탐색
    url_main = KAKAO_LEGACY_DETAIL_API.format(place_id=place_id)
    resp2 = requests.get(url_main, headers=headers, timeout=10)
    if resp2.status_code != 200:
        return menus
    try:
        data2 = resp2.json()
    except json.JSONDecodeError:
        return menus

    if isinstance(data2, dict):
        lst2 = (
            data2.get("menu", [])
            or data2.get("menuList")
            or data2.get("basicInfo", {}).get("menuInfo", {}).get("menuList")
        )
        if isinstance(lst2, list):
            for item in lst2:
                if not isinstance(item, dict):
                    continue
                name = item.get("name") or item.get("menu")
                price = item.get("price") or item.get("price_desc")
                norm = _normalize_menu_item(name, price)
                if norm:
                    menus.append(norm)

    return menus


def _fetch_kakao_menu_from_initial_state(place_id: str) -> List[Dict]:
    """HTML 내 __INITIAL_STATE__ JSON 블록에서 메뉴 추출"""
    url = KAKAO_PLACE_URL.format(place_id=place_id)
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"status={resp.status_code}")

    html = resp.text
    m = re.search(r"__INITIAL_STATE__\s*=\s*({.*?});", html, re.S)
    if not m:
        return []

    state_raw = m.group(1)
    try:
        data = json.loads(state_raw)
    except Exception:
        # JS 객체 표기(단일 따옴표 등) 때문에 JSON 변환 실패 가능 → 안전하게 포기
        return []

    menus: List[Dict] = []
    # 가능한 여러 경로를 순회하며 menuList 추출
    paths = [
        ["place", "menuList"],
        ["menu", "menuList"],
        ["basicInfo", "menuInfo", "menuList"],
    ]

    for path in paths:
        cur = data
        for key in path:
            if not isinstance(cur, dict):
                cur = None
                break
            cur = cur.get(key)
        if not cur or not isinstance(cur, list):
            continue
        for item in cur:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("menu")
            price = item.get("price") or item.get("price_desc")
            norm = _normalize_menu_item(name, price)
            if norm:
                menus.append(norm)
        if menus:
            break

    return menus


def _fetch_kakao_menu_selenium(place_id: str) -> List[Dict]:
    """Selenium으로 cont_menu/list_menu를 파싱 (이전 Selenium-only 구현 유지)"""
    menus: List[Dict] = []
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,720")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)")

    driver = webdriver.Chrome(options=options)
    try:
        # 카카오 상세 페이지 직접 접근
        driver.get(KAKAO_PLACE_URL.format(place_id=place_id))

        # '메뉴' 탭 클릭 시도 (없으면 통과)
        try:
            menu_tab = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(.,'메뉴')]"))
            )
            menu_tab.click()
        except Exception:
            pass

        # 메뉴 리스트 로딩 대기
        # 실제 메뉴는 탭 ul(list_tab)이 아니라, 하단의 상품 영역 ul.list_goods > li 에 들어있음
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "div.wrap_goods ul.list_goods > li")
            )
        )
        time.sleep(1)  # 초기 렌더링 여유

        # "메뉴 더보기" 버튼(a._link_more 등)을 여러 번 클릭해서 전체 메뉴 로딩 시도
        for i in range(5):
            try:
                more_btn = driver.find_element(
                    By.CSS_SELECTOR, "a._link_more, a.link_more"
                )
            except Exception:
                break

            try:
                if more_btn.is_displayed() and more_btn.is_enabled():
                    logger.info(f"카카오 Selenium 메뉴 더보기 클릭 시도 #{i+1}")
                    driver.execute_script("arguments[0].click();", more_btn)
                    time.sleep(1.5)
                else:
                    break
            except Exception:
                break

        # 메뉴 아이템 전부 선택
        items = driver.find_elements(
            By.CSS_SELECTOR, "div.wrap_goods ul.list_goods > li"
        )
        logger.warning(f"카카오 Selenium raw li 개수(list_goods): {len(items)}")
        for it in items:
            name = ""
            price = None

            # 이름 후보 셀렉터들 (info_goods 구조 포함)
            name_selectors = [
                ".info_menu .loss_word",
                ".info_menu .tit_item",
                ".info_goods .tit_item",
                ".tit_item",
                ".txt_menu",
            ]
            for sel in name_selectors:
                try:
                    text = it.find_element(By.CSS_SELECTOR, sel).text.strip()
                    if text:
                        name = text
                        break
                except Exception:
                    continue

            # 가격 후보 셀렉터들
            price_selectors = [
                ".info_menu .price_menu",
                ".info_menu .desc_item",
                ".info_goods .desc_item",
                ".desc_item",
                ".price_menu",
            ]
            for sel in price_selectors:
                try:
                    price_txt = it.find_element(By.CSS_SELECTOR, sel).text
                    digits = re.sub(r"[^0-9]", "", price_txt)
                    if digits:
                        price = int(digits)
                        break
                except Exception:
                    continue

            if name:
                menus.append({"name": name, "price": price})
    finally:
        driver.quit()

    # 중복 제거
    seen = set()
    dedup: List[Dict] = []
    for m in menus:
        key = (m["name"], m["price"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(m)
    return dedup

