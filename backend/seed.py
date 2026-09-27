import sys
import os

# Add the project root to sys.path so we can import from backend as a module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base, engine, SessionLocal
from backend.app.models.models import User, Product, RoleEnum
from backend.app.core.security import get_password_hash

def seed_data():
    print("Dropping and recreating all tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        print("Seeding Users...")
        # Hash passwords (configurable via environment variable)
        default_pwd = os.getenv("DEFAULT_USER_PASSWORD", "nyrix2026")
        hashed_pw = get_password_hash(default_pwd)

        users_to_create = [
            User(username="othmane", password_hash=hashed_pw, role=RoleEnum.ADMIN),
            User(username="karime", password_hash=hashed_pw, role=RoleEnum.WAREHOUSE),
            User(username="packer", password_hash=hashed_pw, role=RoleEnum.PACKER),
            User(username="mehdi", password_hash=hashed_pw, role=RoleEnum.B2B),
        ]
        db.add_all(users_to_create)
        
        print("Seeding Products...")
        products_to_create = [
            Product(sku="AW-01", name="Air Wallet", landed_cost=0.0, global_stock=0, packer_stock=0),
            Product(sku="WL-CUIR-001", name="Portefeuille Slim Cuir Noir", landed_cost=0.0, global_stock=0, packer_stock=0),
            Product(sku="WL-RFID-089", name="Porte-cartes RFID Métal", landed_cost=0.0, global_stock=0, packer_stock=0),
        ]
        db.add_all(products_to_create)
        
        db.commit()
        print("Seed completed successfully!")
        
        # Summary
        print("\n--- Model Summary ---")
        print(f"Users Count: {db.query(User).count()}")
        print(f"Products Count: {db.query(Product).count()}")
        print("Tables created:")
        for table in Base.metadata.sorted_tables:
            print(f"- {table.name}")
        print("---------------------")

    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
