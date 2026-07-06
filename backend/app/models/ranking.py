from sqlalchemy import Column, String, Integer, Float, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), ForeignKey("jobs.job_id"), index=True, nullable=False)
    candidate_id = Column(String(50), ForeignKey("candidates.candidate_id"), index=True, nullable=False)
    rank = Column(Integer)
    similarity_score = Column(Float)
    tfidf_score = Column(Float)
    semantic_score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", foreign_keys=[job_id])
    candidate = relationship("Candidate", foreign_keys=[candidate_id])
