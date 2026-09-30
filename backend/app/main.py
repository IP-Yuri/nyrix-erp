from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from backend.app.api import routes_auth, routes_finance, routes_warehouse, routes_packer, routes_b2b, routes_digylog
from backend.app.core.dependencies import require_role

app = FastAPI(title="NYRIX ERP System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_auth.router)
app.include_router(routes_finance.router)
app.include_router(routes_warehouse.router)
app.include_router(routes_packer.router)
app.include_router(routes_b2b.router)
app.include_router(routes_digylog.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/test-admin-only", dependencies=[Depends(require_role(["ADMIN"]))])
def test_admin_only():
    return {"message": "Hello Admin"}

# Mount frontend directory at the root / dynamically resolved
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
