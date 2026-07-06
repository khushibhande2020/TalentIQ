from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.job import Job
from app.schemas.schemas import JobCreate, JobOut
from app.services.job_analysis import process_job
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobOut, status_code=201)
def upload_job(payload: JobCreate, db: Session = Depends(get_db)):
    """
    Ingest a job description, run NER + embedding, persist to DB.
    Mirrors notebook's analyze_job_description + generate_job_embedding.
    """
    logger.info("Processing new job: %s", payload.title or "(untitled)")
    processed = process_job(payload.description)

    job = Job(
        job_id=f"JOB_{uuid.uuid4().hex[:12].upper()}",
        title=payload.title,
        description=payload.description,
        entities=processed["entities"],
        embedding=processed["embedding"],
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    return db.query(Job).order_by(Job.created_at.desc()).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
