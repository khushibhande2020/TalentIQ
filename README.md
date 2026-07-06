# TalentIQ AI — Workforce Decision Intelligence Platform

AI-powered candidate profiling, semantic job matching, and workforce analytics.  
Built for the Google GenAI Hackathon.

---

## Quick Start (Local)

### Prerequisites
- Python 3.10 – 3.12
- Node.js 18+
- Git

### 1. Clone & configure

```bash
git clone <repo-url>
cd talentiq/backend
cp .env.example .env
# Edit .env — at minimum set GEMINI_API_KEY if you want AI features
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download NLP models (one-time, ~2 minutes)
python -m spacy download en_core_web_sm
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords')"

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API runs at http://localhost:8000  
Swagger docs at http://localhost:8000/docs

### 3. Load candidate data

```bash
# Load 1000 candidates for quick testing
python seed_db.py /path/to/candidates.jsonl --limit 1000

# Load full dataset (may take 30-60 min for 100K candidates — embeddings are generated)
python seed_db.py /path/to/candidates.jsonl
```

### 4. Frontend

```bash
cd ../frontend
npm install
npm run dev
```

App runs at http://localhost:5173

### Demo Workflow

1. **Upload Job** → paste a job description → AI processes NER + embeddings
2. **Rankings** → select the job → run match → see top candidates ranked by TF-IDF + semantic similarity
3. **Candidates** → browse and filter the full pool
4. **Workforce Intelligence** → view hiring funnel, skill distribution, trends
5. **Strategy Simulator** → adjust salary/exp/location → recompute fit
6. **Executive Report** → generate weekly AI-powered summary
7. **AI Copilot** → ask natural language questions about your talent pool
8. **AI Evaluation** → measure Precision@K, Recall@K, NDCG, MRR

---

## Feature Flags (backend/.env)

All features degrade gracefully — the app runs correctly with everything disabled.

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_GEMINI` | `false` | Gemini AI for copilot, reports, insights |
| `ENABLE_BIGQUERY` | `false` | Google BigQuery for scalable analytics |
| `ENABLE_GPU_ACCELERATION` | `false` | NVIDIA RAPIDS cuDF (auto-falls back to pandas) |
| `ENABLE_MULTI_AGENT` | `false` | 8-agent orchestration pipeline |
| `ENABLE_EVALUATION` | `true` | AI quality metrics dashboard |
| `ENABLE_AI_COPILOT` | `true` | Natural language hiring assistant |
| `ENABLE_STRATEGY_SIMULATOR` | `true` | Hiring parameter simulation |
| `ENABLE_EXECUTIVE_REPORTS` | `true` | AI-generated board reports |

---

## Gemini Setup

1. Get an API key: https://aistudio.google.com/apikey
2. Edit `backend/.env`:
   ```
   ENABLE_GEMINI=true
   ENABLE_MULTI_AGENT=true
   GEMINI_API_KEY=your-key-here
   ```
3. Restart the backend server
4. Verify: http://localhost:8000/health/gemini

The copilot, executive reports, and all AI insights activate automatically.

---

## BigQuery Setup

1. Create a Google Cloud project
2. Enable the BigQuery API
3. Create a service account with BigQuery Data Editor + Job User roles
4. Download the service account JSON key
5. Edit `backend/.env`:
   ```
   ENABLE_BIGQUERY=true
   GOOGLE_CLOUD_PROJECT=your-project-id
   BIGQUERY_DATASET=talentiq
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
   ```
6. Install the BigQuery client: `pip install google-cloud-bigquery`
7. Verify: http://localhost:8000/health/bigquery

When enabled, analytics queries run in BigQuery; SQLite is always the fallback.

---

## Docker Compose

```bash
# From project root
docker-compose up --build

# Frontend: http://localhost:80
# Backend:  http://localhost:8000
# Swagger:  http://localhost:8000/docs
```

To configure Gemini in Docker:
```bash
# Create backend/.env with your keys, then:
docker-compose up --build
```

Or pass env vars directly:
```bash
GEMINI_API_KEY=your-key ENABLE_GEMINI=true docker-compose up
```

Seed data into the running container:
```bash
docker-compose exec backend python seed_db.py /data/candidates.jsonl --limit 1000
```

---

## Google Cloud Run Deployment

### Quick deploy

```bash
# Set your project
export PROJECT_ID=your-gcp-project-id

# Build and deploy
./deploy/deploy-cloudrun.sh $PROJECT_ID
```

### Step by step

```bash
# 1. Authenticate
gcloud auth login
gcloud config set project $PROJECT_ID

# 2. Create secrets
echo -n "your-gemini-key" | gcloud secrets create talentiq-gemini-key --data-file=-
echo -n "sqlite:////tmp/talentiq.db" | gcloud secrets create talentiq-db-url --data-file=-

# 3. Build image
docker build -t gcr.io/$PROJECT_ID/talentiq-backend:latest ./backend/
docker push gcr.io/$PROJECT_ID/talentiq-backend:latest

# 4. Deploy
gcloud run deploy talentiq-backend \
  --image gcr.io/$PROJECT_ID/talentiq-backend:latest \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 1 \
  --set-env-vars "ENVIRONMENT=production,ENABLE_GEMINI=true" \
  --set-secrets "GEMINI_API_KEY=talentiq-gemini-key:latest"
```

For Cloud Run + BigQuery, attach a service account with BigQuery roles:
```bash
gcloud run services update talentiq-backend \
  --service-account talentiq-sa@$PROJECT_ID.iam.gserviceaccount.com
```

---

## Matching Algorithm (preserved from notebook)

```
Stage 1 — TF-IDF Cosine Similarity
  vectorizer = TfidfVectorizer(max_features=5000)
  X = vectorizer.fit_transform(candidate_combined_texts)
  tfidf_scores = cosine_similarity(job_vector, X)[0]

Stage 2 — Semantic Embedding Similarity
  model = SentenceTransformer("all-MiniLM-L6-v2")
  semantic_scores = cosine_similarity(job_embedding, candidate_embeddings)[0]

Final Score = (tfidf_score + semantic_score) / 2.0
Candidates sorted descending by Final Score → Top-K returned
```

---

## Project Structure

```
talentiq/
├── backend/
│   ├── app/
│   │   ├── agents/          # 8 Gemini-powered agents + orchestrator
│   │   ├── api/routes/      # 12 REST route modules
│   │   ├── core/            # config, gemini, cache, metrics, logging, retry
│   │   ├── db/              # SQLAlchemy session (SQLite + PostgreSQL)
│   │   ├── models/          # ORM: candidates, jobs, rankings
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── services/        # AI services: matching, evaluation, BigQuery, analytics
│   ├── seed_db.py           # CLI: bulk-load candidates.jsonl
│   ├── requirements.txt
│   ├── Dockerfile           # Multi-stage, Cloud Run ready
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/           # 12 pages
│   │   ├── components/      # Sidebar, Layout, UI primitives, CandidateModal
│   │   ├── lib/             # api.ts, utils.ts
│   │   ├── hooks/           # useTheme
│   │   └── types/           # Full TypeScript interfaces
│   ├── Dockerfile
│   └── vite.config.ts       # /api and /health proxied to backend
├── deploy/
│   ├── cloudrun.yaml
│   └── deploy-cloudrun.sh
└── docker-compose.yml
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/jobs` | Upload job + run NER + embedding |
| POST | `/api/v1/match` | Run TF-IDF + Semantic match |
| GET | `/api/v1/match/{job_id}` | Get cached rankings |
| GET | `/api/v1/candidates` | List candidates (search/filter/paginate) |
| GET | `/api/v1/candidates/{id}` | Full candidate profile |
| POST | `/api/v1/upload-candidates` | Bulk import JSONL (background) |
| GET | `/api/v1/analytics` | Platform-wide analytics (cached 5min) |
| GET | `/api/v1/download-results/{job_id}` | Export rankings CSV |
| GET | `/api/v1/command-center` | AI Command Center data |
| GET | `/api/v1/workforce` | Workforce intelligence |
| POST | `/api/v1/simulator` | Run hiring strategy simulation |
| GET | `/api/v1/executive-report` | AI executive report |
| POST | `/api/v1/copilot` | AI copilot chat |
| GET | `/api/v1/evaluation/run` | Run/get evaluation metrics |
| GET | `/api/v1/gpu-benchmark` | CPU vs GPU benchmark |
| GET | `/health` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/services` | Feature flags + config |
| GET | `/health/gemini` | Gemini connectivity |
| GET | `/health/database` | DB connectivity |

