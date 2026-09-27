import os
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

DIGYLOG_BASE_URL = os.getenv("DIGYLOG_BASE_URL", "https://api.digylog.com/api/v2/seller")
DIGYLOG_REFERER = os.getenv("DIGYLOG_REFERER", "https://apiseller.digylog.com")
DIGYLOG_API_TOKEN = os.getenv("DIGYLOG_API_TOKEN", "")
DIGYLOG_STORE_NAME = os.getenv("DIGYLOG_STORE_NAME", "Nyrix")

class DigylogClient:
    """
    Official API Client for DigyLog Seller V2.1.0 / V2.5
    Extracted from the official Postman Documentation.
    """

    def __init__(self, token: Optional[str] = None, base_url: Optional[str] = None):
        self.base_url = (base_url or DIGYLOG_BASE_URL).rstrip("/")
        self.token = token or DIGYLOG_API_TOKEN
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Referer": DIGYLOG_REFERER,
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    def _is_live(self) -> bool:
        return bool(self.token and self.token.strip())

    def get_order_info(self, tracking_number: str) -> Dict[str, Any]:
        """GET /api/v2/seller/order/:traking/infos"""
        if not self._is_live():
            return {
                "mock": True,
                "tracking": tracking_number,
                "status": "LIVRE",
                "message": "Simulated Digylog response (No DIGYLOG_API_TOKEN provided)"
            }
        
        url = f"{self.base_url}/order/{tracking_number}/infos"
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def get_orders_history(self, tracking_numbers: List[str]) -> Dict[str, Any]:
        """GET /api/v2/seller/historics?trackings=TRK1,TRK2"""
        if not self._is_live():
            return {"mock": True, "trackings": tracking_numbers, "history": []}
        
        trks = ",".join(tracking_numbers)
        url = f"{self.base_url}/historics?trackings={trks}"
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def create_standard_orders(
        self,
        orders: List[Dict[str, Any]],
        store: Optional[str] = None,
        network: int = 1,
        sent_type: int = 1,
        check_duplicate: int = 0
    ) -> Dict[str, Any]:
        """POST /api/v2/seller/orders/standard"""
        target_store = store or DIGYLOG_STORE_NAME
        payload = {
            "network": network,
            "store": target_store,
            "sentType": sent_type,
            "checkDuplicate": check_duplicate,
            "orders": orders
        }
        if not self._is_live():
            return {
                "mock": True,
                "status": "success",
                "created_count": len(orders),
                "orders": [{"num": o.get("num"), "status": "CREATED_MOCK"} for o in orders]
            }

        url = f"{self.base_url}/orders/standard"
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, json=payload, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def download_labels(self, tracking_numbers: List[str]) -> Dict[str, Any]:
        """POST /api/v2/seller/labels"""
        if not self._is_live():
            return {"mock": True, "labels_url": f"https://mock.digylog.com/labels/{','.join(tracking_numbers)}.pdf"}

        url = f"{self.base_url}/labels"
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json={"orders": tracking_numbers}, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def get_stores(self) -> List[Dict[str, Any]]:
        """GET /api/v2/seller/stores"""
        if not self._is_live():
            return [{"id": 1, "name": "NYRIX Boutique Test"}]

        url = f"{self.base_url}/stores"
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def get_cities(self) -> List[Dict[str, Any]]:
        """GET /api/v2/seller/cities"""
        if not self._is_live():
            return [{"id": 1, "name": "Casablanca"}, {"id": 2, "name": "Rabat"}, {"id": 3, "name": "Marrakech"}]

        url = f"{self.base_url}/cities"
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

# Global default instance
digylog_client = DigylogClient()
