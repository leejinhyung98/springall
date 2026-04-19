"""
Neon DB 연결 설정
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

# .env 파일 자동 로드 (프로젝트 루트에서 찾기)
# 현재 파일 위치에서 상위 디렉토리로 올라가며 .env 파일 탐색
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

# 환경 변수에서 데이터베이스 설정 읽기
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL 환경 변수가 설정되지 않았습니다. "
        ".env 파일에 Neon DB URL을 설정해주세요. "
        "예: DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
    )

# DATABASE_URL 정규화
# 1. psql 명령어 형식 제거 (psql 'postgresql://...' -> postgresql://...)
if DATABASE_URL.strip().startswith("psql"):
    # psql 'postgresql://...' 또는 psql "postgresql://..." 형식 처리
    import re
    # 따옴표로 감싸진 URL 추출
    match = re.search(r"['\"](postgresql[^'\"]+)['\"]", DATABASE_URL)
    if match:
        DATABASE_URL = match.group(1)
    else:
        # psql 다음의 URL 추출
        DATABASE_URL = re.sub(r"^psql\s+['\"]?", "", DATABASE_URL).strip()
        DATABASE_URL = re.sub(r"['\"]$", "", DATABASE_URL).strip()

# 2. postgresql+psycopg:// -> postgresql:// 변환
# SQLAlchemy는 postgresql:// 형식을 더 안정적으로 처리합니다
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1)
elif DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)

# 디버깅: URL 형식 확인 (비밀번호는 마스킹)
if DATABASE_URL:
    masked_url = DATABASE_URL
    # 비밀번호 부분 마스킹 (보안)
    if "@" in masked_url:
        parts = masked_url.split("@")
        if ":" in parts[0]:
            user_pass = parts[0].split(":")
            if len(user_pass) == 2:
                masked_url = f"{user_pass[0]}:****@{parts[1]}"
    print(f"[INFO] DATABASE_URL 로드됨: {masked_url[:50]}...")

# PostgreSQL 연결 엔진 생성
try:
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False  # SQL 쿼리 로깅 (개발 시 True로 변경 가능)
    )
except Exception as e:
    print(f"[ERROR] DATABASE_URL 파싱 실패: {e}")
    print(f"   URL (마스킹됨): {masked_url[:100]}...")
    raise ValueError(
        f"DATABASE_URL 형식이 올바르지 않습니다: {str(e)}\n"
        f"올바른 형식: postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
    ) from e

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스 생성
Base = declarative_base()


def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

