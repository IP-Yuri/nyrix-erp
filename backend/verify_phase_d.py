import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def run_tests():
    print("Running Phase D Static Verification Tests...\n")
    
    endpoints = [
        ("/", "index.html"),
        ("/index.html", "index.html"),
        ("/othmane_dashboard.html", "othmane_dashboard.html"),
        ("/karime_warehouse.html", "karime_warehouse.html"),
        ("/packer_tablet.html", "packer_tablet.html"),
        ("/mehdi_b2b.html", "mehdi_b2b.html"),
        ("/css/styles.css", ".css"),
        ("/js/api.js", ".js"),
        ("/js/auth.js", ".js"),
        ("/js/othmane.js", ".js"),
        ("/js/karime.js", ".js"),
        ("/js/packer.js", ".js"),
        ("/js/mehdi.js", ".js"),
    ]
    
    for path, expected in endpoints:
        response = client.get(path)
        assert response.status_code == 200, f"Failed to fetch {path}, status: {response.status_code}"
        print(f"Success: GET {path} returned 200 OK")
        
    print("\nPhase D Static Verification Passed Successfully!")

if __name__ == "__main__":
    run_tests()
