from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class UserOut(BaseModel):
    id: str
    username: str
    role: str

    model_config = {"from_attributes": True}

# --- Product Schemas ---
class ProductBase(BaseModel):
    sku: str
    name: str
    global_stock: int
    packer_stock: int

class ProductOperationalOut(ProductBase):
    model_config = {"from_attributes": True}

class ProductAdminOut(ProductBase):
    landed_cost: float
    model_config = {"from_attributes": True}

# --- Order Schemas ---
class OrderItemLogisticsOut(BaseModel):
    id: str
    product_sku: str
    quantity: int
    
    model_config = {"from_attributes": True}

class OrderItemFullOut(OrderItemLogisticsOut):
    unit_price: float
    
    model_config = {"from_attributes": True}

class OrderLogisticsOut(BaseModel):
    tracking_number: str
    type: str
    client_name: str
    city: str
    status: str
    items: List[OrderItemLogisticsOut] = []

    model_config = {"from_attributes": True}

class OrderFullOut(OrderLogisticsOut):
    payment_method: str
    payment_status: str
    cod_amount: float
    owner_id: Optional[str]
    items: List[OrderItemFullOut] = []
    
    model_config = {"from_attributes": True}

# --- Operational Schemas ---
class TransferOut(BaseModel):
    id: str
    from_user_id: str
    to_user_id: str
    product_sku: str
    quantity: int
    status: str
    created_at: datetime
    
    model_config = {"from_attributes": True}

class StockLedgerOut(BaseModel):
    id: str
    product_sku: str
    user_id: str
    action: str
    quantity: int
    created_at: datetime
    
    model_config = {"from_attributes": True}

class InboundShipmentOut(BaseModel):
    id: str
    invoice_ref: str
    status: str
    items_json: Any
    created_at: datetime
    
    model_config = {"from_attributes": True}

class DiscrepancyOut(BaseModel):
    id: str
    product_sku: str
    quantity_missing: int
    reason: str
    status: str
    reported_by: str
    created_at: datetime
    
    model_config = {"from_attributes": True}

class CODCashBookOut(BaseModel):
    id: str
    driver_ref: str
    amount_mad: float
    logged_by: str
    created_at: datetime
    
    model_config = {"from_attributes": True}
