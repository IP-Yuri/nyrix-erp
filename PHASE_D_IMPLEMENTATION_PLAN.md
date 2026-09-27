# Phase D Implementation Plan

This document outlines the step-by-step approach to execute Phase D (Frontend Implementation & FastAPI Static Serving) for the NYRIX ERP System, matching the mockups and enforcing all security and layout constraints.

## 1. FastAPI Static File Mounting (`backend/app/main.py`)
- We will import `StaticFiles` from `fastapi.staticfiles`.
- We will mount the `frontend/` directory to the root `/` path so that hitting `http://127.0.0.1:8000/` automatically serves `index.html` and the subsequent dashboard HTML files. This avoids CORS complexity and `file://` protocol restrictions during development.

## 2. Global Design System & Core JS
- **`frontend/css/styles.css`**:
  - Implement a high-end enterprise SaaS aesthetic: Canvas background `#F3F4F6`, pure white cards `#FFFFFF` with `24px–32px` padding and soft shadows (`box-shadow: 0 4px 6px rgba(0,0,0,0.05)`).
  - Typography: `Inter`, system-ui.
  - Semantic Colors: Primary Blue (`#2563EB`), Confirm Green (`#10B981`), Alert Red (`#EF4444`).
  - Right-aligned numerical/currency columns in tables.
  - **Strict Guardrail**: Absolute zero `@media print` rules or PDF functionalities.
- **`frontend/js/api.js`**:
  - The "Server-Truth" Fetch Wrapper: A centralized `apiCall(url, options)` function that attaches the `Authorization: Bearer <token>` header to all requests.
  - It will intercept `401`/`403` responses and automatically redirect to `index.html`.
  - It ensures UI components only render or update *after* a successful `200 OK` response.
- **`frontend/index.html` & `frontend/js/auth.js`**:
  - The centralized login screen matching the `login interface` mockup.
  - Calls `POST /api/auth/login`. On success, stores `access_token`, `username`, and `role` in `localStorage`.
  - Immediately redirects to the role's dedicated page (`othmane_dashboard.html`, `karime_warehouse.html`, `packer_tablet.html`, or `mehdi_b2b.html`).

## 3. Othmane's Interface (Role: `ADMIN`)
- **Files**: `frontend/othmane_dashboard.html`, `frontend/js/othmane.js`
- **Layout**: Fixed Left Vertical Sidebar (`240px` width) for navigation (NYRIX logo top, logout bottom) and a main content area.
- **Dynamic Views (No Reloads)**:
  - **View 1 (📥 Importation - Default)**: The Landed Cost Engine workspace. Includes an interactive SKU row builder, parameters (Invoice Ref, Exchange Rate, Duties, Ancillaries, Allocation Key), a live recap table, and the "Valider & Ajouter au Stock" submit button. The right column displays KPI cards populated via `GET /api/finance/valuation`.
  - **View 2 (📦 Stock)**: Full-width data table showing `SKU`, Designation, Source Invoice, Warehouse/Packer Stock, Unit Landed Cost (MAD), and Total Valuation. Includes search/filter bars and a Discrepancy Approval panel allowing Othmane to APPROVE/REJECT reported stock gaps.

## 4. Karime's Context-Aware Interface (Role: `WAREHOUSE`)
- **Files**: `frontend/karime_warehouse.html`, `frontend/js/karime.js`
- **Dynamic State Switching**: On page load, calls `GET /api/warehouse/inbound`.
  - **State 1 (Import Reception Day)**: If an `EN_ATTENTE_RECEPTION` shipment exists, displays a top full-width validation card, a 50/50 middle row (Audit Ledger + Transfer to Packer form), and a bottom live inventory table (strictly hiding landed costs).
  - **State 2 (Normal Operations Day)**: If no inbound shipments exist, displays a top full-width B2B & B2C logistics table (masking B2B prices) with a Matchmaker B2C sync test button. The bottom row is 50/50: Transfer to Packer form and COD Cash Log form/history.
- **Exceptions Navigation**: Modals or slide-out drawers triggered via top navbar buttons for reporting discrepancies, processing returns, and viewing the ledger history.

## 5. Packer's Tablet Kiosk Interface (Role: `PACKER`)
- **Files**: `frontend/packer_tablet.html`, `frontend/js/packer.js`
- **Layout**: Strictly touch-optimized for tablets. Massive toggle buttons, `min-height: 60px` for all clickable areas, and zero hover effects.
- **Tabs**:
  - **Tab 1 ([1] À Réceptionner)**: Full-width list of `PENDING_ACCEPT` transfers. Large green "✓ Confirmer la réception" button per row.
  - **Tab 2 ([2] À Préparer)**: CSS Grid of `PENDING_PACKING` Order Cards (tracking number, items to pick, B2B/B2C badging). Large blue "✓ Colis Terminé" button per order.

## 6. Mehdi's B2B Interface (Role: `B2B`)
- **Files**: `frontend/mehdi_b2b.html`, `frontend/js/mehdi.js`
- **Layout**: Horizontal stacked layout featuring:
  - **Top Banner**: KPIs (`Encaissement du Jour`, `En Attente Virement`).
  - **Row 1 (Création Commande B2B)**: Vertically stacked form sections:
    1. Client Parameters (Name, City, Terms).
    2. Negotiated Items (repeating SKU/Qty/Price rows).
    3. Financial Summary (HT, TVA, TTC) and the primary "Générer la Commande B2B" submit button.
  - **Row 2 (Suivi Logistique & Paiements B2B)**: Wide data grid tracking submitted B2B orders with a "✓ Valider Paiement" action button for unpaid invoices.
