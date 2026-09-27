# NYRIX ERP: Zero-Budget ($0) Deployment & Architecture Plan (Test Phase)

This document establishes the official technical architecture inventory, platform feasibility analysis (including Vercel evaluation), and an actionable step-by-step implementation plan to deploy the **NYRIX ERP System** at **$0 cost** for testing, staging, and client demonstration.

---

## 1. Complete Technology Stack Inventory

The NYRIX ERP is architected as an **Asynchronous Monolith**, where the high-performance Python ASGI backend serves both the RESTful API endpoints and the static multi-page frontend from a single web service.

| Component | Technology | Role & Package Details |
| :--- | :--- | :--- |
| **Backend Core** | Python 3.10+ / FastAPI | High-concurrency ASGI REST API with dependency injection |
| **Server Engine** | Uvicorn | Production-ready ASGI server worker |
| **Data & ORM Layer** | SQLAlchemy 2.0 | Object-relational mapping covering 9 relational entities |
| **Production Database** | PostgreSQL (`psycopg2-binary`) | Relational database engine targeted for staging and production |
| **Fallback Database** | SQLite (`nyrix_dev.db`) | File-based zero-dependency database used in local development |
| **Data Validation** | Pydantic (v2) | Strict schema validation for incoming JSON payloads |
| **Security & Cryptography** | `python-jose`, `passlib[bcrypt]` | Salted password hashing and JWT token issuance/verification |
| **Data Science / Imports** | `pandas`, `openpyxl` | Excel (`.xlsx`) parsing for Landed Cost and Customs Duty calculation |
| **Frontend Framework** | Pure Vanilla HTML5 / ES6+ JS | Zero compilation step; modular fetch clients (`api.js`, `auth.js`) |
| **Styling & Design System** | Tailwind CSS (CDN) + Google Fonts | Stitch-compliant UI layout, custom brand themes (`Geist`, `Inter`) |
| **Monolith Hosting** | `FastAPI.staticfiles` | Direct mounting of `/frontend` onto `/` eliminating all CORS issues |

---

## 2. Platform Assessment: Is Vercel Doable?

### Technical Verdict: **Technically possible, but NOT recommended for this architecture.**

While Vercel is best-in-class for static frontend hosting and Next.js, hosting this specific Python FastAPI backend presents distinct constraints:

1. **No Persistent Disk for SQLite**:
   - Vercel operates on read-only, ephemeral serverless micro-VMs.
   - Any writes to `nyrix_dev.db` (orders created, inventory updated) are wiped upon execution completion or cold reboot.
2. **Heavy Python Bundle Cold Starts**:
   - The inclusion of `pandas`, `openpyxl`, `cryptography`, and `psycopg2-binary` brings the uncompressed dependencies near 150MB+.
   - On Vercel free tier, Python serverless invocations will suffer from 5–10 second cold start latency after brief inactivity.
3. **Execution Timeouts & Chunking**:
   - Vercel Serverless Functions on the free tier enforce a hard 10–15s timeout, which can cause timeouts when parsing large Excel import sheets via Pandas.

---

## 3. Platform Comparison Matrix ($0 Free Tier)

| Feature / Platform | **Render.com + Neon** *(Recommended)* | **Fly.io** *(All-in-One)* | **Vercel + Neon** | **Hugging Face Spaces** |
| :--- | :--- | :--- | :--- | :--- |
| **Monthly Cost** | **$0.00** | **$0.00** | **$0.00** | **$0.00** |
| **Architecture** | Continuous Web Service | Container + Volume | Serverless Functions | Continuous Docker |
| **Database Model** | Free Cloud PostgreSQL | Local SQLite on Volume | Free Cloud PostgreSQL | Local SQLite |
| **CORS Complexities** | None (Single Origin) | None (Single Origin) | Possible if split | None (Single Origin) |
| **Cold Starts** | ~30s on wake-up | None / Fast wake | 5–10s on every invoke | Low |
| **Setup Complexity** | Very Low (Git push) | Medium (CLI + CC verify) | High (`vercel.json`) | Low (Dockerfile) |

---

## 4. Execution Plan: Primary Recommendation (Render.com + Neon PostgreSQL)

This setup keeps all project code, API routes, and frontend pages unified under **one URL**, while using a managed, free cloud PostgreSQL database.

### Step 1: Prepare Repository Deployment Files
We will create the necessary deployment configurations in the repository root:

1. **`Procfile`**:
   ```makefile
   web: uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
   ```
2. **`runtime.txt`** (specifying Python version):
   ```text
   python-3.11.9
   ```

### Step 2: Provision Free Cloud PostgreSQL (Neon.tech)
1. Register for a free account at [neon.tech](https://neon.tech).
2. Create a project named `nyrix-erp-test`.
3. Copy the pooled connection string:
   ```env
   DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require
   ```

### Step 3: Configure Render Web Service
1. Connect GitHub repository to [render.com](https://render.com).
2. Select **New Web Service**:
   - **Runtime**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python backend/seed.py && uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` (512MB RAM, 0.1 CPU)
3. Set Environment Variables:
   - `DATABASE_URL`: `<your-neon-postgres-connection-string>`
   - `SECRET_KEY`: `<generated-random-32-byte-hex>`
   - `ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440`

---

## 5. Alternative Execution Plan: Fly.io (Truly 100% In One Place)

If external database services are undesirable and the team prefers keeping the existing SQLite database (`nyrix_dev.db`) intact:

### Step 1: Create a `Dockerfile`
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:////data/nyrix_dev.db
EXPOSE 8080
CMD python backend/seed.py && uvicorn backend.app.main:app --host 0.0.0.0 --port 8080
```

### Step 2: Attach Free Persistent Storage
Fly.io provides up to 3GB of persistent NVMe volume storage for free:
```bash
flyctl volumes create nyrix_data --size 1 --region cdg
```
*Result: The container, frontend, backend, and database reside within a single self-contained virtual instance.*

---

## 6. Post-Deployment Verification & Smoke Tests

After deployment, perform verification across all 4 system roles:

| Verification Target | Endpoint / Route | Expected Outcome |
| :--- | :--- | :--- |
| **System Health** | `GET /health` | Returns `{"status": "ok"}` with HTTP 200 |
| **Frontend Root** | `GET /` | Loads Stitch Login screen with CSS and assets |
| **Admin Authentication** | `POST /api/auth/login` (`othmane`) | Issues JWT and redirects to `othmane_dashboard.html` |
| **Warehouse Interface** | `GET /karime_warehouse.html` | Displays inventory status and inbound shipments |
| **Packer Tablet Kiosk** | `GET /packer_tablet.html` | Shows tablet touch layout and packing queues |
| **B2B Portal** | `GET /mehdi_b2b.html` | Loads wholesale order submission form |
| **Landed Cost Engine** | `POST /api/finance/import` | Processes multi-SKU import and updates database stock |
