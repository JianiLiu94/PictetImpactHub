from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    ticker = Column(String, primary_key=True)
    company_name = Column(String, nullable=False)
    isin = Column(String, nullable=False, index=True)
    market_cap_usd_m = Column(Float)
    sales_usd_m = Column(Float)

    holdings = relationship("Holding", back_populates="company")
    social_impacts = relationship("SocialImpact", back_populates="company")
    biodiversity_impacts = relationship("BiodiversityImpact", back_populates="company")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)

    holdings = relationship("Holding", back_populates="portfolio")


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False, index=True)
    ticker = Column(String, ForeignKey("companies.ticker"), nullable=False, index=True)
    cusip = Column(String)
    sedol = Column(String)
    pct_of_fund = Column(Float, nullable=False)
    shares = Column(Integer)
    market_value = Column(Float)

    portfolio = relationship("Portfolio", back_populates="holdings")
    company = relationship("Company", back_populates="holdings")


class SocialImpact(Base):
    __tablename__ = "social_impact"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("companies.ticker"), nullable=False, index=True)
    scope = Column(String, nullable=False)
    category = Column(String, nullable=False)
    stakeholder = Column(String, nullable=False)
    wellby_per_dollar = Column(Float, nullable=False)
    wellby_abs = Column(Float, nullable=False)

    company = relationship("Company", back_populates="social_impacts")


class BiodiversityImpact(Base):
    __tablename__ = "biodiversity_impact"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("companies.ticker"), nullable=False, index=True)
    scope = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)

    company = relationship("Company", back_populates="biodiversity_impacts")
