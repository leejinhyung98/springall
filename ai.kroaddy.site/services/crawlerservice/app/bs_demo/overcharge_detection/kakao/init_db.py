"""
데이터베이스 테이블 초기화 스크립트
"""
import os
from .database import engine, Base

def init_db():
    """데이터베이스 테이블 생성"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ 데이터베이스 테이블 생성 완료")
    except Exception as e:
        print(f"❌ 데이터베이스 테이블 생성 실패: {e}")
        raise

if __name__ == "__main__":
    init_db()

