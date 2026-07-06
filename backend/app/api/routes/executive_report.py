"""
Executive Board Report — AI-generated report with optional PDF export.
Uses Agent 8 (ExecutiveReportAgent) plus raw analytics.
"""
from __future__ import annotations
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.job import Job
from app.services.analytics import get_analytics

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/executive-report", tags=["executive-report"])

CACHE_TTL = 600


@router.get("")
def get_executive_report(
    period: str = Query("weekly", enum=["weekly", "monthly", "quarterly"]),
    db: Session = Depends(get_db),
):
    cache_key = f"exec_report:{period}"
    cached = cache_get(cache_key)
    if cached:
        return {**cached, "_cached": True}

    analytics = get_analytics(db)
    jobs_raw = db.query(Job).order_by(Job.created_at.desc()).limit(20).all()
    jobs = [{"title": j.title, "status": j.status, "job_id": j.job_id} for j in jobs_raw]

    # Run Executive Report Agent
    from app.agents.report_agent import ExecutiveReportAgent
    agent_result = ExecutiveReportAgent().run(analytics=analytics, jobs=jobs, period=period)

    data = {
        "report": agent_result.get("report", {}),
        "analytics_snapshot": {
            "total_candidates": analytics["total_candidates"],
            "total_jobs": analytics["total_jobs"],
            "total_rankings": analytics["total_rankings"],
            "avg_match_score": analytics.get("avg_similarity_score"),
            "top_skills": analytics.get("top_skills", [])[:10],
            "experience_distribution": analytics.get("experience_distribution", []),
            "industry_distribution": analytics.get("industry_distribution", []),
        },
        "active_jobs": jobs,
        "period": period,
        "generated_at": agent_result.get("generated_at"),
        "agent_status": agent_result.get("status"),
    }
    cache_set(cache_key, data, CACHE_TTL)
    return data


@router.get("/pdf")
def download_executive_report_pdf(
    period: str = Query("weekly", enum=["weekly", "monthly", "quarterly"]),
    db: Session = Depends(get_db),
):
    """Export the executive report as a PDF."""
    # Get report data (cached or fresh)
    cache_key = f"exec_report:{period}"
    cached = cache_get(cache_key)
    if not cached:
        analytics = get_analytics(db)
        jobs_raw = db.query(Job).order_by(Job.created_at.desc()).limit(20).all()
        jobs = [{"title": j.title, "status": j.status, "job_id": j.job_id} for j in jobs_raw]
        from app.agents.report_agent import ExecutiveReportAgent
        agent_result = ExecutiveReportAgent().run(analytics=analytics, jobs=jobs, period=period)
        cached = {"report": agent_result.get("report", {}), "period": period}

    pdf_bytes = _build_pdf(cached)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="talentiq_report_{period}.pdf"'},
    )


def _build_pdf(data: dict) -> bytes:
    """Build a simple text-based PDF using reportlab if available, else plain HTML fallback."""
    report = data.get("report", {})
    period = data.get("period", "weekly")

    try:
        from reportlab.pdfgen import canvas  # type: ignore
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.units import inch

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph("TalentIQ AI — Executive Report", styles["Title"]))
        story.append(Paragraph(f"Period: {period.capitalize()}", styles["Normal"]))
        story.append(Spacer(1, 0.2 * inch))

        if summary := report.get("executive_summary"):
            story.append(Paragraph("Executive Summary", styles["Heading2"]))
            story.append(Paragraph(summary, styles["Normal"]))
            story.append(Spacer(1, 0.15 * inch))

        if findings := report.get("key_findings"):
            story.append(Paragraph("Key Findings", styles["Heading2"]))
            for f in findings:
                story.append(Paragraph(f"• {f}", styles["Normal"]))
            story.append(Spacer(1, 0.15 * inch))

        if recs := report.get("recommendations"):
            story.append(Paragraph("Recommendations", styles["Heading2"]))
            for r in recs:
                story.append(Paragraph(f"• {r}", styles["Normal"]))

        doc.build(story)
        return buf.getvalue()

    except ImportError:
        # Plain text PDF fallback (minimal)
        lines = [
            "TalentIQ AI — Executive Report",
            f"Period: {period.capitalize()}",
            "",
            "Executive Summary:",
            report.get("executive_summary", "N/A"),
            "",
            "Key Findings:",
            *[f"- {f}" for f in (report.get("key_findings") or [])],
            "",
            "Recommendations:",
            *[f"- {r}" for r in (report.get("recommendations") or [])],
        ]
        content = "\n".join(lines).encode("utf-8")
        # Wrap in minimal valid PDF
        return _minimal_pdf(content.decode())


def _minimal_pdf(text: str) -> bytes:
    """Absolute minimum PDF when reportlab not available."""
    lines = text.split("\n")
    stream_lines = []
    y = 750
    for line in lines[:50]:
        safe = line.replace("(", "\\(").replace(")", "\\)").replace("\\", "\\\\")
        stream_lines.append(f"BT /F1 11 Tf 50 {y} Td ({safe}) Tj ET")
        y -= 16
    stream = "\n".join(stream_lines)
    stream_bytes = stream.encode("latin-1", errors="replace")

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>endobj\n"
        + f"4 0 obj<</Length {len(stream_bytes)}>>\nstream\n".encode()
        + stream_bytes
        + b"\nendstream\nendobj\n"
        + b"xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000274 00000 n\n"
        + b"trailer<</Size 5/Root 1 0 R>>\nstartxref\n0\n%%EOF"
    )
    return pdf
