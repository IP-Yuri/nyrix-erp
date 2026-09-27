# Phase B Implementation Plan

This document outlines the detailed steps to execute Phase B (JWT Authentication, RBAC Gatekeeper & Masked Pydantic Schemas) for the NYRIX ERP System.

## Step 1: JWT & Password Security (`backend/app/core/security.py`)
- Define `SECRET_KEY`, `ALGORITHM` (HS256), and `ACCESS_TOKEN_EXPIRE_MINUTES`.
- Add `create_access_token(data: dict, expires_delta: timedelta | None = None)` to generate JWTs encoding `sub` (user ID), `username`, and `role` in the payload.
- Add `decode_access_token(token: str)` to parse and validate the JWT, raising credentials exceptions on failure.

## Step 2: RBAC Gatekeeper Dependencies (`backend/app/core/dependencies.py`)
- Instantiate `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")`.
- Implement `get_current_user`: This dependency will extract the token from the header, decode it, and fetch the user from the DB. If invalid, it will raise a 401 Unauthorized exception.
- Implement `require_role(allowed_roles: list[str])`: A dependency factory that returns a function. This function will check if the current user's role is in `allowed_roles`. If not, it will raise exactly `HTTPException(status_code=403, detail="403 Forbidden: Access Denied")`.

## Step 3: Pydantic Schemas with Strict Financial Data Masking (`backend/app/schemas/schemas.py`)
We will create Pydantic v2 schemas (`model_config = {"from_attributes": True}`):
- **Auth Schemas**: 
  - `LoginRequest` (`username`, `password`)
  - `TokenResponse` (`access_token`, `token_type`, `role`, `username`)
  - `UserOut` (`id`, `username`, `role`)
- **Product Schemas**:
  - `ProductAdminOut`: Includes all fields including `landed_cost`.
  - `ProductOperationalOut`: Excludes `landed_cost` (for WAREHOUSE, PACKER, B2B).
- **Order Schemas**:
  - `OrderItemFullOut` & `OrderFullOut`: Includes all fields including `unit_price`, `cod_amount`, `payment_status`.
  - `OrderItemLogisticsOut` & `OrderLogisticsOut`: Strips financial/pricing data from items and orders, leaving only logistics data (`tracking_number`, `type`, `client_name`, `city`, `status`, `items` without price).
- **Operational Schemas**: Base Request/Response schemas for `Transfers`, `StockLedger`, `InboundShipments`, `Discrepancies`, and `CODCashBook`.

## Step 4: Authentication Router & App Wiring (`backend/app/api/routes_auth.py` & `backend/app/main.py`)
- **`routes_auth.py`**:
  - Implement `POST /api/auth/login`: This will accept either `LoginRequest` JSON or `OAuth2PasswordRequestForm` (for Swagger UI support), verify the password, and return the `TokenResponse`.
  - Implement `GET /api/auth/me`: A protected endpoint that returns the current user profile.
- **`main.py`**:
  - Add `CORSMiddleware` with appropriate settings.
  - Mount the auth router: `app.include_router(routes_auth.router)`.

## Step 5: Automated Phase B Verification (`backend/verify_phase_b.py`)
- We will write a verification script using `fastapi.testclient.TestClient`.
- The script will test:
  1. Successful login for `othmane`, `karime`, `packer`, `mehdi` using `nyrix2026`, asserting a 200 OK and a valid `TokenResponse`.
  2. Failed login with wrong password, asserting a 401 Unauthorized.
  3. A dummy protected route requiring `ADMIN` role. We will test accessing it with the `PACKER` JWT and assert it raises a 403 Forbidden response.
- We will execute this script and present the terminal output.
