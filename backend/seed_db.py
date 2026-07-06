#!/usr/bin/env python3
"""
seed_db.py — load a candidates.jsonl file into the TalentIQ SQLite database.

Usage:
    python seed_db.py candidates.jsonl [--batch 500] [--no-embeddings]
"""

import argparse
import json
import sys
from pathlib import Path

# Make sure the app package is importable from this script
sys.path.insert(0, str(Path(__file__).parent))

from app.core.logging import setup_logging, get_logger
from app.db.session import init_db, SessionLocal
from app.services.candidate_profiling import bulk_upsert_candidates

setup_logging()
logger = get_logger("seed")


def load_jsonl(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def main():
    parser = argparse.ArgumentParser(description="Seed TalentIQ database from a JSONL file")
    parser.add_argument("jsonl_file", help="Path to candidates.jsonl")
    parser.add_argument("--batch", type=int, default=500, help="Batch size (default 500)")
    parser.add_argument(
        "--no-embeddings",
        action="store_true",
        help="Skip embedding generation (much faster, but match quality will be lower)",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max candidates to load (0=all)")
    args = parser.parse_args()

    logger.info("Initialising database…")
    init_db()

    db = SessionLocal()
    records = []
    total = 0

    try:
        for record in load_jsonl(args.jsonl_file):
            records.append(record)
            if len(records) >= args.batch:
                count = bulk_upsert_candidates(db, records, generate_embeddings=not args.no_embeddings)
                total += count
                logger.info("Progress: %d candidates processed", total)
                records = []
            if args.limit and total >= args.limit:
                break

        if records:
            count = bulk_upsert_candidates(db, records, generate_embeddings=not args.no_embeddings)
            total += count
    finally:
        db.close()

    logger.info("Done! %d candidates seeded.", total)


if __name__ == "__main__":
    main()
