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
    last_invoice_ref: Optional[str] = None
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
    created_at: Optional[datetime] = None
    packed_at: Optional[datetime] = None
    packed_by: Optional[str] = None
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

class InboundInvoiceItemOut(BaseModel):
    sku: str
    name: Optional[str] = None
    quantity: int
    landed_cost: float

class InboundInvoiceOut(BaseModel):
    id: str
    invoice_ref: str
    supplier_name: Optional[str] = None
    status: str
    created_at: datetime
    total_skus: int
    total_quantity: int
    total_amount_mad: float
    items: List[InboundInvoiceItemOut] = []

    model_config = {"from_attributes": True}

class ProductReturnOut(BaseModel):
    id: str
    product_sku: str
    product_name: Optional[str] = None
    quantity: int
    condition: str
    action: str
    tracking_number: Optional[str] = None
    reason: Optional[str] = None
    reported_by: str
    reported_by_username: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

