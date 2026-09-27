# Phase C Implementation Plan

This document details the step-by-step approach to execute Phase C (Core Services, Role API Routers & Matchmaker Worker) for the NYRIX ERP System, ensuring strict separation of concerns, transactional integrity, and alignment with the `.drawio` system workflows.

## 1. Module 1: Finance & Landed Cost Engine (Role: `ADMIN`)
**Files:** `backend/app/services/landed_cost.py` & `backend/app/api/routes_finance.py`
- **Landed Cost Engine (`services/landed_cost.py`)**: Implement an algorithm to distribute shipping and customs fees across SKUs using `VALUE`, `WEIGHT`, or `QUANTITY` allocation keys.
- **`POST /api/finance/import`**: 
  - Accepts product lines (JSON or file) along with landed cost parameters (exchange rate, duties, insurance, clearance, etc.).
  - Executes an **atomic database transaction**:
    - Updates `Products.global_stock` and `Products.landed_cost`.
    - Inserts `IMPORT` actions into `Stock_Ledger`.
    - Creates an `Inbound_Shipments` record with status `EN_ATTENTE_RECEPTION`.
- **`GET /api/finance/valuation`**: Returns the `ADMIN` KPI cards (`total_valuation_mad`, `total_global_stock`, `orders_today_count`) and lists inventory using `ProductAdminOut` (showing landed costs).
- **Discrepancy Approvals**: 
  - `GET /api/finance/discrepancies`: Lists Karime's reported discrepancies.
  - `PUT /api/finance/discrepancies/{id}/resolve`: Allows `APPROVE` (atomically deducting from `global_stock` and logging `DISCREPANCY_APPROVED` in `Stock_Ledger`) or `REJECT`.

## 2. Module 2: Warehouse Operations (Role: `WAREHOUSE`)
**File:** `backend/app/api/routes_warehouse.py`
- **Inbound Shipments**:
  - `GET /api/warehouse/inbound`: Checks for `EN_ATTENTE_RECEPTION` shipments (Karime's UI State 1).
  - `PUT /api/warehouse/inbound/{id}/verify`: Updates shipment to `RECEPTIONNE` upon physical check.
- **Inventory & Orders (Masked data)**:
  - `GET /api/warehouse/inventory`: Returns `ProductOperationalOut` (masks `landed_cost`).
  - `GET /api/warehouse/orders`: Unified B2B/B2C table using `OrderLogisticsOut` (masks B2B financial pricing).
- **Internal Logistics**:
  - `POST /api/warehouse/transfers`: Initiates custody handover to the Packer. Creates `Transfers` record with `PENDING_ACCEPT` status. **Stock is deliberately NOT deducted yet**.
  - `POST /api/warehouse/discrepancies`: Reports discrepancies (`DOUANE`, `TESTS`, `CADEAUX`) with `PENDING_APPROVAL` status.
  - `POST /api/warehouse/returns`: Physical inspection of returns. Logs `QUARANTINE` (deduct/isolate) or `RETURN_RESTORED` (reintegrate to `global_stock`) based on state.
- **COD & Ledger History**:
  - `POST /api/warehouse/cod` & `GET /api/warehouse/cod`: Logs and views Digylog cash collections into `COD_Cash_Book`.
  - `GET /api/warehouse/ledger`: Returns filterable stock history.

## 3. Module 3: Packer Tablet Operations (Role: `PACKER`)
**File:** `backend/app/api/routes_packer.py`
- **Chain of Custody Handshake**:
  - `GET /api/packer/transfers`: Views `PENDING_ACCEPT` transfers from the warehouse.
  - `PUT /api/packer/transfers/{id}/accept`: Executes an atomic transaction to update transfer to `ACCEPTED`, deduct `quantity` from `Products.global_stock`, increment `Products.packer_stock`, and log `TRANSFER_ACCEPTED` into `Stock_Ledger`.
- **Order Packing Flow**:
  - `GET /api/packer/orders`: Views `PENDING_PACKING` orders using `OrderLogisticsOut`.
  - `PUT /api/packer/orders/{tracking_number}/pack`: Verifies `packer_stock >= quantity`, deducts from `packer_stock`, updates order status to `READY`, and logs `PACKED_OUT` into `Stock_Ledger`.

## 4. Module 4: Mehdi B2B Wholesale (Role: `B2B`)
**File:** `backend/app/api/routes_b2b.py`
- **`POST /api/b2b/orders`**: Injects a custom B2B wholesale order (`B2B-XXXX`) assigned to `current_user.id`, with `payment_method = 'VIREMENT'` and custom `unit_price`.
- **`GET /api/b2b/orders`**: Returns `OrderFullOut` allowing Mehdi to track his sales.
- **`PUT /api/b2b/orders/{tracking_number}/payment`**: Marks B2B order `payment_status = 'PAID'`.

## 5. Module 5: The Matchmaker Sync Engine
**File:** `backend/app/services/matchmaker.py`
- Implements the `.drawio` "Matchmaker Engine Flow" reconciling Google Sheet B2C rows (flagged 'Envoyer au SL') with Digylog logistics APIs.
- Wraps HTTP operations in resilient `try/except` blocks (using `httpx`) so the system won't crash if external API keys are missing/invalid.
- Implements a local offline simulation flag to safely inject B2C dummy orders into the DB for testing without live API hits.

## 6. Automated End-to-End Verification
**File:** `backend/verify_phase_c.py`
- Builds a `FastAPI TestClient` script simulating the full company lifecycle step-by-step:
  1. Othmane (ADMIN) imports stock.
  2. Karime (WAREHOUSE) verifies inbound and creates a transfer.
  3. Packer (PACKER) accepts the transfer (testing atomic stock movement).
  4. Mehdi (B2B) creates a wholesale order & Matchmaker creates a simulated B2C order.
  5. Packer (PACKER) packs both orders (testing packer_stock deduction).
  6. Karime (WAREHOUSE) logs COD cash and reports a discrepancy.
  7. Othmane (ADMIN) approves the discrepancy.
  8. Verifies data integrity, `Stock_Ledger` logs, and RBAC visibility (e.g. Packer cannot see landed costs).
