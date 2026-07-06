from sqlalchemy import Column, String, Integer, Text, JSON, DateTime
from sqlalchemy.sql import func
from app.db.session import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255))
    description = Column(Text, nullable=False)
    entities = Column(JSON)       # spaCy NER entities
    embedding = Column(JSON)      # SentenceTransformer embedding
    status = Column(String(20), default="pending")  # pending / matched
    created_at = Column(DateTime(timezone=True), server_default=func.now())
