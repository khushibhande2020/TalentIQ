from sqlalchemy import Column, String, Float, Integer, Boolean, JSON, DateTime, Text
from sqlalchemy.sql import func
from app.db.session import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(String(50), unique=True, index=True, nullable=False)

    # Profile fields
    anonymized_name = Column(String(100))
    headline = Column(String(255))
    summary = Column(Text)
    location = Column(String(100))
    country = Column(String(100))
    years_of_experience = Column(Float)
    current_title = Column(String(150))
    current_company = Column(String(150))
    current_company_size = Column(String(50))
    current_industry = Column(String(100))

    # Nested JSON fields
    career_history = Column(JSON)
    education = Column(JSON)
    skills = Column(JSON)
    certifications = Column(JSON)
    languages = Column(JSON)
    redrob_signals = Column(JSON)

    # Preprocessed text for matching
    combined_text = Column(Text)

    # Embedding stored as JSON list
    embedding = Column(JSON)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
