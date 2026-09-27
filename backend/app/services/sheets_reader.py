import os
import csv
from io import StringIO
from typing import List, Dict, Any, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local")

GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "1ZIZrxWkbIbcqNjkccaTlU0te6QL8Ui9iNSZlxfRwMao")

def get_sheet_csv_url(sheet_id: Optional[str] = None) -> str:
    sid = sheet_id or GOOGLE_SHEET_ID
    return f"https://docs.google.com/spreadsheets/d/{sid}/export?format=csv"

def fetch_confirmed_orders(sheet_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches Fatima Zahra's Google Sheet and extracts all orders flagged 'Envoyer au SL'.
    """
    url = get_sheet_csv_url(sheet_id)
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        csv_text = resp.text

    reader = csv.DictReader(StringIO(csv_text))
    confirmed_orders = []

    for row in reader:
        confirmation = (row.get("Confirmation") or "").strip()
        if confirmation == "Envoyer au SL":
            num = (row.get("Num") or "").strip()
            name = (row.get("full_name") or "Client Inconnu").strip()
            phone = (row.get("phone") or "").strip()
            city = (row.get("city") or "Casablanca").strip()
            address = (row.get("address") or "").strip()
            product = (row.get("product") or "").strip()
            tracking = (row.get("Tracking") or "").strip()
            
            try:
                qty = int(row.get("qte") or 1)
            except ValueError:
                qty = 1

            try:
                price = float(row.get("total_price") or 0.0)
            except ValueError:
                price = 0.0

            confirmed_orders.append({
                "sheet_order_id": num,
                "client_name": name,
                "phone": phone,
                "city": city,
                "address": address,
                "product_raw": product,
                "quantity": qty,
                "total_price": price,
                "tracking": tracking,
                "status_livraison": (row.get("Status de Livraison") or "").strip()
            })

    return confirmed_orders
