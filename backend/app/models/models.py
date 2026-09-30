from sqlalchemy import Column, String, Integer, Float, ForeignKey, Enum, JSON, DateTime
from sqlalchemy.orm import relationship
from backend.app.core.database import Base
from datetime import datetime
import uuid
import enum

def generate_uuid():
    return str(uuid.uuid4())

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    WAREHOUSE = "WAREHOUSE"
    PACKER = "PACKER"
    B2B = "B2B"

class OrderTypeEnum(str, enum.Enum):
    B2C = "B2C"
    B2B = "B2B"

class OrderStatusEnum(str, enum.Enum):
    PENDING_PACKING = "PENDING_PACKING"
    READY = "READY"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    RETURNED = "RETURNED"

class PaymentMethodEnum(str, enum.Enum):
    COD = "COD"
    VIREMENT = "VIREMENT"

class PaymentStatusEnum(str, enum.Enum):
    UNPAID = "UNPAID"
    PAID = "PAID"

class TransferStatusEnum(str, enum.Enum):
    PENDING_ACCEPT = "PENDING_ACCEPT"
    ACCEPTED = "ACCEPTED"

class StockActionEnum(str, enum.Enum):
    IMPORT = "IMPORT"
    TRANSFER_ACCEPTED = "TRANSFER_ACCEPTED"
    PACKED_OUT = "PACKED_OUT"
    QUARANTINE = "QUARANTINE"
    RETURN_RESTORED = "RETURN_RESTORED"
    DISCREPANCY_APPROVED = "DISCREPANCY_APPROVED"

class ShipmentStatusEnum(str, enum.Enum):
    EN_ATTENTE_RECEPTION = "EN_ATTENTE_RECEPTION"
    RECEPTIONNE = "RECEPTIONNE"

class DiscrepancyReasonEnum(str, enum.Enum):
    DOUANE = "DOUANE"
    TESTS = "TESTS"
    CADEAUX = "CADEAUX"

class DiscrepancyStatusEnum(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Product(Base):
    __tablename__ = "products"
    sku = Column(String(255), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    landed_cost = Column(Float, default=0.0)
    global_stock = Column(Integer, default=0)
    packer_stock = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def suggested_price(self) -> float:
        return round((self.landed_cost or 0.0) * 1.25, 2) if self.landed_cost else 150.0

class Order(Base):
    __tablename__ = "orders"
    tracking_number = Column(String(255), primary_key=True, index=True)
    sheet_order_id = Column(String(255), index=True, nullable=True)
    type = Column(Enum(OrderTypeEnum), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    client_name = Column(String(255), nullable=False)
    city = Column(String(255), nullable=False)
    status = Column(Enum(OrderStatusEnum), nullable=False)
    payment_method = Column(Enum(PaymentMethodEnum), nullable=False)
    payment_status = Column(Enum(PaymentStatusEnum), nullable=False)
    cod_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    packed_at = Column(DateTime, nullable=True)
    packed_by = Column(String(255), nullable=True)

    items = relationship("OrderItem", back_populates="order")

    @property
    def total_amount_ht(self) -> float:
        return sum((item.quantity * (item.unit_price or 0.0)) for item in (self.items or []))

    @property
    def total_amount_ttc(self) -> float:
        return round(self.total_amount_ht * 1.2, 2)

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    tracking_number = Column(String(255), ForeignKey("orders.tracking_number"), nullable=False)
    product_sku = Column(String(255), ForeignKey("products.sku"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")

    @property
    def product_name(self) -> str:
        return self.product.name if self.product else self.product_sku

class Transfer(Base):
    __tablename__ = "transfers"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    from_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    product_sku = Column(String(255), ForeignKey("products.sku"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(Enum(TransferStatusEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    product = relationship("Product")

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_sku = Column(String(255), ForeignKey("products.sku"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    action = Column(Enum(StockActionEnum), nullable=False)
    quantity = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class InboundShipment(Base):
    __tablename__ = "inbound_shipments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_ref = Column(String(255), nullable=False)
    supplier_name = Column(String(255), nullable=True)
    status = Column(Enum(ShipmentStatusEnum), nullable=False)
    items_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ProductReturn(Base):
    __tablename__ = "product_returns"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_sku = Column(String(255), ForeignKey("products.sku"), nullable=False)
    quantity = Column(Integer, nullable=False)
    condition = Column(String(50), nullable=False)  # "INTACT" or "DAMAGED"
    action = Column(String(50), nullable=False)     # "RETURN_RESTORED" or "QUARANTINE"
    tracking_number = Column(String(255), nullable=True)
    reason = Column(String(255), nullable=True)
    reported_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
    reporter = relationship("User", foreign_keys=[reported_by])

class Discrepancy(Base):
    __tablename__ = "discrepancies"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_sku = Column(String(255), ForeignKey("products.sku"), nullable=False)
    quantity_missing = Column(Integer, nullable=False)
    reason = Column(Enum(DiscrepancyReasonEnum), nullable=False)
    status = Column(Enum(DiscrepancyStatusEnum), nullable=False)
    reported_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class CODCashBook(Base):
    __tablename__ = "cod_cash_book"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    driver_ref = Column(String(255), nullable=False)
    amount_mad = Column(Float, nullable=False)
    logged_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
