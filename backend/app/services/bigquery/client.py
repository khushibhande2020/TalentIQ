"""
BigQuery client.
When ENABLE_BIGQUERY=false or credentials missing, ALL calls fall back
transparently to the SQLite/SQLAlchemy layer — zero code changes in callers.
"""
from __future__ import annotations
from typing import Any, Generator
import contextlib

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

_bq_client = None
_bq_available = False


def _init_bq():
    global _bq_client, _bq_available
    if not settings.ENABLE_BIGQUERY:
        return
    if not settings.GOOGLE_CLOUD_PROJECT:
        logger.warning("ENABLE_BIGQUERY=true but GOOGLE_CLOUD_PROJECT not set — disabling BigQuery")
        return
    try:
        from google.cloud import bigquery  # type: ignore
        import os
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
        _bq_client = bigquery.Client(project=settings.GOOGLE_CLOUD_PROJECT)
        _bq_available = True
        logger.info("BigQuery client initialised (project=%s, dataset=%s)",
                    settings.GOOGLE_CLOUD_PROJECT, settings.BIGQUERY_DATASET)
    except ImportError:
        logger.warning("google-cloud-bigquery not installed. pip install google-cloud-bigquery")
    except Exception as e:
        logger.warning("BigQuery init failed (falling back to SQLite): %s", e)


def get_bq_client():
    """Return the BigQuery client or None if unavailable."""
    if not _bq_available:
        _init_bq()
    return _bq_client


def is_bigquery_available() -> bool:
    return _bq_available


def bq_query(sql: str, params: list | None = None) -> list[dict[str, Any]]:
    """
    Execute a BigQuery SQL query. Returns list of row dicts.
    Raises RuntimeError if BigQuery is not available.
    """
    client = get_bq_client()
    if client is None:
        raise RuntimeError("BigQuery not available")
    from google.cloud import bigquery  # type: ignore
    job_config = None
    if params:
        job_config = bigquery.QueryJobConfig(query_parameters=params)
    job = client.query(sql, job_config=job_config)
    return [dict(row) for row in job.result()]


def ensure_dataset() -> bool:
    """Create BigQuery dataset if it doesn't exist. Returns True on success."""
    client = get_bq_client()
    if client is None:
        return False
    try:
        from google.cloud import bigquery  # type: ignore
        dataset_id = f"{settings.GOOGLE_CLOUD_PROJECT}.{settings.BIGQUERY_DATASET}"
        dataset = bigquery.Dataset(dataset_id)
        dataset.location = "US"
        client.create_dataset(dataset, exists_ok=True)
        logger.info("BigQuery dataset ready: %s", dataset_id)
        return True
    except Exception as e:
        logger.error("Failed to create BigQuery dataset: %s", e)
        return False


def upload_dataframe_to_bq(df, table_name: str, write_disposition: str = "WRITE_TRUNCATE") -> bool:
    """Upload a pandas DataFrame to a BigQuery table."""
    client = get_bq_client()
    if client is None:
        return False
    try:
        table_id = f"{settings.GOOGLE_CLOUD_PROJECT}.{settings.BIGQUERY_DATASET}.{table_name}"
        from google.cloud import bigquery  # type: ignore
        job_config = bigquery.LoadJobConfig(
            write_disposition=write_disposition,
            autodetect=True,
        )
        job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
        job.result()
        logger.info("Uploaded %d rows to BigQuery table %s", len(df), table_id)
        return True
    except Exception as e:
        logger.error("BigQuery upload failed: %s", e)
        return False
