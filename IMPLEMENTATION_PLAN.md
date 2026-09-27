# Phase A Implementation Plan

This document outlines the detailed steps to execute Phase A (Project Scaffolding, Merged Database Schema & Seed Script) for the NYRIX ERP System. 

## Step 1: Project Directory Structure Scaffolding
We will begin by creating the strict file and folder hierarchy as defined by the `.drawio` project structure tab.

- **Backend Scaffold**:
  - We will create a `backend` directory.
  - Set up `backend/requirements.txt` with all necessary dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, etc.).
  - Create `backend/.env.example` to document environment variables (like `DATABASE_URL`).
  - Scaffold the FastAPI app structure:
    - `backend/app/main.py` (initialization & health check).
    - `backend/app/core/` (containing `config.py`, `database.py`, `security.py`, `dependencies.py`).
    - `backend/app/models/models.py` (for SQLAlchemy ORM models).
    - `backend/app/schemas/schemas.py` (for Pydantic models).
    - `backend/app/api/` (containing all route files: `routes_auth.py`, `routes_finance.py`, `routes_warehouse.py`, `routes_packer.py`, `routes_b2b.py`).
    - `backend/app/services/` (containing `matchmaker.py`, `landed_cost.py`).
  - Create the `backend/seed.py` file.

- **Frontend Scaffold**:
  - We will create a `frontend` directory.
  - Create all the view shells: `index.html`, `othmane_dashboard.html`, `karime_warehouse.html`, `mehdi_b2b.html`, `packer_tablet.html`.
  - Create `frontend/css/styles.css`.
  - Create `frontend/js/` directory with script shells (`api.js`, `auth.js`, `othmane.js`, `karime.js`, `packer.js`, `mehdi.js`).
  - Create `frontend/assets/` directory and copy the logo from the `assests/nyrix logo/` directory into it.

*(Note: API routes, background workers, and frontend code logic will be left empty or as boilerplate stubs, in line with Phase A restrictions).*

## Step 2: Database Schema Implementation (`models.py`)
We will configure `backend/app/models/models.py` to reconcile the `.drawio` ERD, the Blueprint `.md`, and the `Cahier de charge.pdf`. We will implement the following 9 SQLAlchemy models:

1. **`Users`**: UUID PK, username (unique), password_hash, role (enum), created_at.
2. **`Products`**: SKU PK, name, landed_cost, global_stock, packer_stock, created_at.
3. **`Orders`**: tracking_number PK, sheet_order_id, type, owner_id (FK), client_name, city, status, payment_method, payment_status, cod_amount, created_at.
4. **`Order_Items`**: UUID PK, tracking_number (FK), product_sku (FK), quantity, unit_price.
5. **`Transfers`**: UUID PK, from_user_id (FK), to_user_id (FK), product_sku (FK), quantity, status, created_at.
6. **`Stock_Ledger`**: UUID PK, product_sku (FK), user_id (FK), action (enum), quantity, created_at.
7. **`Inbound_Shipments`**: UUID PK, invoice_ref, status, items_json, created_at.
8. **`Discrepancies`**: UUID PK, product_sku (FK), quantity_missing, reason, status, reported_by (FK), created_at.
9. **`COD_Cash_Book`**: UUID PK, driver_ref, amount_mad, logged_by (FK), created_at.

Relationships between models will be mapped carefully via SQLAlchemy `relationship` constructs.

## Step 3: Database Connection & Seed Script Execution
- **Database Config**: Update `backend/app/core/database.py` to connect to PostgreSQL via `DATABASE_URL` found in `.env`. We will implement a fallback to SQLite (`sqlite:///./nyrix_dev.db`) for immediate local testing if the PostgreSQL URL is not present.
- **Seed Script (`backend/seed.py`)**:
  - Implement a script to drop (if necessary) and recreate all the tables.
  - Insert the 4 necessary users (Othmane, Karime, Packer, Mehdi), hashing their `nyrix2026` password using the `passlib` context.
  - Insert the 3 default test products: `AW-01` (Air Wallet), `WL-CUIR-001` (Portefeuille Slim Cuir Noir), and `WL-RFID-089` (Porte-cartes RFID Métal).
- **Execution**: Run `python backend/seed.py` via terminal to populate `nyrix_dev.db` (SQLite). 

## Step 4: Verification and Handoff
- Present the terminal output of `seed.py` to the user.
- Provide a summary of the implemented models and confirm all tables were created successfully. Wait for user instruction to proceed to Phase B.
