"""
카카오맵 크롤링 데이터베이스 모델
"""
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Place(Base):
    """장소 정보 테이블"""
    __tablename__ = "kakao_places"
    
    id = Column(Integer, primary_key=True, index=True)
    kakao_place_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    address = Column(String(500))
    lat = Column(Float, nullable=False, index=True)
    lng = Column(Float, nullable=False, index=True)
    phone = Column(String(50))
    category = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계 설정
    menus = relationship("Menu", back_populates="place", cascade="all, delete-orphan")
    
    # 복합 인덱스 (좌표 기반 검색 최적화)
    __table_args__ = (
        Index('idx_place_location', 'lat', 'lng'),
    )


class Menu(Base):
    """메뉴 가격 정보 테이블"""
    __tablename__ = "kakao_menus"
    
    id = Column(Integer, primary_key=True, index=True)
    place_id = Column(Integer, ForeignKey("kakao_places.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_name = Column(String(200), nullable=False)
    price = Column(Integer)  # 가격 (원 단위, NULL 가능)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계 설정
    place = relationship("Place", back_populates="menus")
    
    # 중복 방지: 같은 장소의 같은 메뉴명은 하나만 저장
    __table_args__ = (
        UniqueConstraint('place_id', 'menu_name', name='uq_place_menu'),
        Index('idx_menu_place', 'place_id'),
    )

