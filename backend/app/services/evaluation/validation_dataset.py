"""
Curated Validation Dataset for TalentIQ AI Evaluation Framework.

METHODOLOGY
-----------
When labelled ground-truth data (human recruiter rankings) is unavailable,
we use a principled proxy approach widely accepted in IR/RecSys research:

1. SKILL OVERLAP RELEVANCE (Binary + Graded)
   - Extract required skills from job description using spaCy + keyword matching
   - Compute skill overlap ratio: |candidate_skills ∩ job_skills| / |job_skills|
   - Map to relevance grade: 0 (irrelevant), 1 (partial), 2 (relevant), 3 (highly relevant)
   - Threshold: grade ≥ 2 → considered "relevant" for binary metrics (P@K, R@K)

2. EXPERIENCE FIT RELEVANCE
   - Extract required experience range from job description
   - Penalize under/over-experienced candidates
   - Contributes 20% of final relevance score

3. TITLE SEMANTIC SIMILARITY
   - Encode job title + candidate current_title using SentenceTransformer
   - Cosine similarity contributes 20% of final relevance score

4. COMBINED RELEVANCE SCORE = 0.6×skill_overlap + 0.2×exp_fit + 0.2×title_sim
   Thresholds: score ≥ 0.6 → grade 3, ≥ 0.4 → grade 2, ≥ 0.2 → grade 1, else 0

5. VALIDATION QUERIES
   We use 10 diverse synthetic job descriptions spanning different domains,
   experience levels, and tech stacks. Each query targets different subsets
   of the candidate pool, ensuring evaluation covers varied retrieval scenarios.

LIMITATIONS & TRANSPARENCY
---------------------------
- Without human-annotated relevance labels, metrics are approximations.
- Skill overlap is a strong signal but misses semantic equivalence (e.g. "ML" ≈ "Machine Learning").
- We mitigate this by using SentenceTransformer for title similarity.
- All metrics should be interpreted relative to baseline, not as absolute quality.
- This framework is designed for continuous improvement as real labels accumulate.

REFERENCES
----------
- Manning, Raghavan & Schütze (2008) — Introduction to Information Retrieval
- Järvelin & Kekäläinen (2002) — Cumulated gain-based evaluation of IR techniques (nDCG)
- Voorhees (2000) — The TREC-8 Question Answering Track Report (MRR)
"""

from __future__ import annotations
from typing import Any

# ── 10 diverse validation job descriptions ────────────────────────────────────
# Each includes: title, description, required_skills, min_exp, max_exp
VALIDATION_QUERIES: list[dict[str, Any]] = [
    {
        "query_id": "VQ_001",
        "title": "Senior Python Backend Engineer",
        "description": """We are looking for a Senior Python Backend Engineer with strong
        experience in FastAPI or Django, PostgreSQL, Redis, Docker, and cloud platforms
        (AWS or GCP). You will design scalable microservices, optimize database performance,
        and mentor junior engineers. 5+ years of Python experience required.
        Experience with Kafka or RabbitMQ is a plus.""",
        "required_skills": ["python", "fastapi", "django", "postgresql", "redis",
                            "docker", "aws", "gcp", "microservices", "kafka"],
        "min_exp": 5.0,
        "max_exp": 12.0,
    },
    {
        "query_id": "VQ_002",
        "title": "Machine Learning Engineer",
        "description": """Seeking an ML Engineer to build and deploy production ML models.
        Must have strong Python skills, experience with PyTorch or TensorFlow, scikit-learn,
        MLflow, and familiarity with NLP and computer vision. You will work on recommendation
        systems, model training pipelines, and A/B testing frameworks. 3+ years required.""",
        "required_skills": ["python", "pytorch", "tensorflow", "scikit-learn", "mlflow",
                            "nlp", "machine learning", "docker", "kubernetes"],
        "min_exp": 3.0,
        "max_exp": 8.0,
    },
    {
        "query_id": "VQ_003",
        "title": "Frontend React Developer",
        "description": """We need a React developer with TypeScript expertise to build
        beautiful, performant UIs. Must know React 18, TypeScript, Tailwind CSS, Redux,
        REST API integration, and testing with Jest and Cypress. Experience with Next.js
        is preferred. 2-5 years of frontend experience.""",
        "required_skills": ["react", "typescript", "javascript", "tailwind", "redux",
                            "nextjs", "jest", "html", "css", "rest api"],
        "min_exp": 2.0,
        "max_exp": 6.0,
    },
    {
        "query_id": "VQ_004",
        "title": "Data Engineer",
        "description": """Looking for a Data Engineer to build scalable data pipelines.
        Experience with Apache Spark, Airflow, dbt, BigQuery or Redshift, Python, and SQL
        is required. You will design ETL/ELT pipelines, optimize data warehouse performance,
        and ensure data quality. 4+ years in data engineering.""",
        "required_skills": ["apache spark", "airflow", "dbt", "bigquery", "python",
                            "sql", "etl", "data pipeline", "redshift", "kafka"],
        "min_exp": 4.0,
        "max_exp": 10.0,
    },
    {
        "query_id": "VQ_005",
        "title": "DevOps Engineer",
        "description": """We are hiring a DevOps Engineer to manage our cloud infrastructure.
        Expertise in Kubernetes, Docker, Terraform, CI/CD pipelines (GitHub Actions, Jenkins),
        AWS or Azure, and monitoring tools (Prometheus, Grafana) is required.
        Linux administration skills essential. 3-7 years experience.""",
        "required_skills": ["kubernetes", "docker", "terraform", "aws", "azure",
                            "ci/cd", "github actions", "prometheus", "grafana", "linux"],
        "min_exp": 3.0,
        "max_exp": 8.0,
    },
    {
        "query_id": "VQ_006",
        "title": "Full Stack Developer",
        "description": """Seeking a Full Stack Developer proficient in React, Node.js,
        PostgreSQL, MongoDB, REST APIs, and GraphQL. Must be comfortable with both
        frontend and backend development, Docker deployment, and agile workflows.
        2-6 years of full stack experience.""",
        "required_skills": ["react", "node.js", "javascript", "postgresql", "mongodb",
                            "graphql", "rest api", "docker", "typescript"],
        "min_exp": 2.0,
        "max_exp": 7.0,
    },
    {
        "query_id": "VQ_007",
        "title": "Data Scientist",
        "description": """Looking for a Data Scientist to extract insights from large datasets.
        Must have strong skills in Python, pandas, NumPy, scikit-learn, SQL, data visualization
        (matplotlib, seaborn, Tableau), and statistical modeling. Experience with NLP or
        time series analysis is a plus. 2+ years required.""",
        "required_skills": ["python", "pandas", "numpy", "scikit-learn", "sql",
                            "statistics", "tableau", "matplotlib", "machine learning", "nlp"],
        "min_exp": 2.0,
        "max_exp": 8.0,
    },
    {
        "query_id": "VQ_008",
        "title": "Mobile Developer (React Native)",
        "description": """We need a React Native developer to build cross-platform mobile
        applications. Must know React Native, TypeScript, Redux, REST APIs, push notifications,
        App Store and Play Store deployment. Experience with native iOS/Android is a bonus.
        2-5 years mobile development experience.""",
        "required_skills": ["react native", "react", "typescript", "javascript",
                            "redux", "mobile development", "ios", "android", "rest api"],
        "min_exp": 2.0,
        "max_exp": 6.0,
    },
    {
        "query_id": "VQ_009",
        "title": "Cloud Architect",
        "description": """Seeking a Cloud Architect to design enterprise-scale cloud solutions
        on AWS or GCP. Must have deep expertise in cloud networking, security, serverless
        architecture, microservices, IaC (Terraform, CDK), and cost optimization.
        AWS/GCP certification preferred. 7+ years experience.""",
        "required_skills": ["aws", "gcp", "terraform", "kubernetes", "microservices",
                            "serverless", "cloud architecture", "security", "networking"],
        "min_exp": 7.0,
        "max_exp": 20.0,
    },
    {
        "query_id": "VQ_010",
        "title": "Product Manager",
        "description": """Looking for an experienced Product Manager to lead our B2B SaaS
        product. Must have experience with product roadmapping, agile/scrum, user research,
        data-driven decision making, cross-functional collaboration, and go-to-market strategy.
        3-8 years in product management, preferably in tech.""",
        "required_skills": ["product management", "agile", "scrum", "roadmapping",
                            "user research", "analytics", "stakeholder management",
                            "go-to-market", "b2b", "saas"],
        "min_exp": 3.0,
        "max_exp": 10.0,
    },
]
