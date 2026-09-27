\# NYRIX ERP: Master AI Agent Development Blueprint

\#\# 1\. System Overview  
You are building a custom ERP for a logistics and e-commerce business. The system is strictly separated by Role-Based Access Control (RBAC). The architecture prioritizes data immutability, financial tracking, and real-time operational handoffs.

\*   \*\*Backend Stack:\*\* FastAPI (Python), PostgreSQL, SQLAlchemy (ORM), Pydantic.  
\*   \*\*Frontend Stack:\*\* Vanilla HTML/CSS/JS (No frameworks).  
\*   \*\*Core Architectural Rule:\*\* "Server-Truth UI." The frontend never visually updates state without receiving a \`200 OK\` from the database.

\#\# 2\. Database Schema (SQLAlchemy Models)  
Implement the following PostgreSQL tables with exact relationships:

\*   \*\*\`Users\`\*\*  
    \*   \`id\` (UUID, PK)  
    \*   \`username\` (String, Unique)  
    \*   \`hashed\_password\` (String)  
    \*   \`role\` (Enum: \`ADMIN\`, \`WAREHOUSE\`, \`PACKER\`, \`B2B\`)  
\*   \*\*\`Products\`\*\*  
    \*   \`sku\` (String, PK)  
    \*   \`designation\` (String)  
    \*   \`global\_stock\` (Integer, Default 0\) \- \*Managed by WAREHOUSE\*  
    \*   \`packer\_stock\` (Integer, Default 0\) \- \*Managed by PACKER\*  
    \*   \`landed\_cost\` (Float, Default 0.0) \- \*Visible only to ADMIN\*  
\*   \*\*\`Stock\_Ledger\`\*\* (Strictly Immutable/Append-Only)  
    \*   \`id\` (UUID, PK)  
    \*   \`timestamp\` (DateTime, Default Now)  
    \*   \`action\_type\` (Enum: \`IMPORT\`, \`TRANSFER\_ACCEPTED\`, \`QUARANTINE\`, \`PACKED\_OUT\`, \`RETURN\_IN\`)  
    \*   \`sku\` (String, FK to Products)  
    \*   \`quantity\` (Integer, can be negative or positive)  
    \*   \`user\_id\` (UUID, FK to Users)  
\*   \*\*\`Transfers\`\*\* (The Chain of Custody)  
    \*   \`id\` (UUID, PK)  
    \*   \`sku\` (String, FK to Products)  
    \*   \`quantity\` (Integer)  
    \*   \`from\_user\_id\` (UUID)  
    \*   \`to\_user\_id\` (UUID)  
    \*   \`status\` (Enum: \`PENDING\_ACCEPT\`, \`ACCEPTED\`)  
\*   \*\*\`Orders\`\*\*  
    \*   \`id\` (String, PK) \- \*Can be Digylog tracking number or 'B2B-XXX'\*  
    \*   \`type\` (Enum: \`B2C\`, \`B2B\`)  
    \*   \`status\` (Enum: \`PENDING\_PACKING\`, \`READY\`)  
    \*   \`payment\_status\` (Enum: \`UNPAID\`, \`PAID\`) \- \*Used strictly for B2B\*  
\*   \*\*\`Order\_Items\`\*\*  
    \*   \`id\` (UUID, PK)  
    \*   \`order\_id\` (String, FK to Orders)  
    \*   \`product\_sku\` (String, FK to Products)  
    \*   \`quantity\` (Integer)

\#\# 3\. Security & RBAC Configuration  
1\.  \*\*Authentication:\*\* Implement JWT-based login (\`POST /api/auth/login\`).  
2\.  \*\*Dependencies:\*\*   
    \*   Create \`get\_current\_user\` to decode the JWT.  
    \*   Create \`require\_role(allowed\_roles: list\[str\])\` to block unauthorized endpoints (e.g., \`require\_role(\["ADMIN"\])\` for finance routes).

\#\# 4\. API Endpoints & Business Logic

\#\#\# A. Othmane (ADMIN / Finance)  
\*   \*\*\`GET /api/finance/valuation\`\*\*  
    \*   \*Logic:\* Returns \`SUM(global\_stock \* landed\_cost)\` across all products.  
\*   \*\*\`POST /api/products/import\`\*\*  
    \*   \*Payload:\* Excel/CSV file (SKU, Qty, Base Price), \`customs\_fees\` (Float), \`shipping\_fees\` (Float).  
    \*   \*Logic:\* Calculate Landed Cost. Upsert \`Products\` (add to \`global\_stock\`, update \`landed\_cost\`). Insert \`IMPORT\` record into \`Stock\_Ledger\`. Atomic transaction.

\#\#\# B. Karime (WAREHOUSE)  
\*   \*\*\`GET /api/inventory/live\`\*\*  
    \*   \*Logic:\* Returns \`sku\`, \`designation\`, \`global\_stock\`. (Strip out \`landed\_cost\`).  
\*   \*\*\`POST /api/transfers/create\`\*\*  
    \*   \*Payload:\* \`sku\`, \`quantity\`, \`to\_user\_id\` (Packer).  
    \*   \*Logic:\* Validates \`global\_stock \>= quantity\`. Creates \`Transfers\` row with status \`PENDING\_ACCEPT\`. \*\*DO NOT deduct stock yet.\*\*  
\*   \*\*\`POST /api/inventory/adjust\`\*\* (Handles both Quarantine and Returns)  
    \*   \*Payload:\* \`sku\`, \`quantity\` (negative for Quarantine, positive for Returns), \`reason\`.  
    \*   \*Logic:\* Adjusts \`global\_stock\`. Inserts \`QUARANTINE\` or \`RETURN\_IN\` record into \`Stock\_Ledger\`.

\#\#\# C. Packer (PACKER)  
\*   \*\*\`GET /api/transfers/pending\`\*\*  
    \*   \*Logic:\* Returns transfers where \`to\_user\_id \== current\_user\` AND status is \`PENDING\_ACCEPT\`.  
\*   \*\*\`PUT /api/transfers/{id}/accept\`\*\*  
    \*   \*Logic:\* Sets transfer to \`ACCEPTED\`. Deducts \`quantity\` from \`Products.global\_stock\` and adds to \`Products.packer\_stock\`. Inserts \`TRANSFER\_ACCEPTED\` into \`Stock\_Ledger\`. Atomic transaction.  
\*   \*\*\`GET /api/orders/today\`\*\*  
    \*   \*Logic:\* Returns all Orders (B2C and B2B) where status \== \`PENDING\_PACKING\`, grouped with their Order\_Items.  
\*   \*\*\`PUT /api/orders/{id}/pack\`\*\*  
    \*   \*Logic:\* Validates \`packer\_stock \>= sum(order\_items.quantity)\`. Sets order status to \`READY\`. Deducts \`packer\_stock\`. Inserts \`PACKED\_OUT\` into \`Stock\_Ledger\`.

\#\#\# D. Mehdi (B2B)  
\*   \*\*\`POST /api/orders/b2b/create\`\*\*  
    \*   \*Payload:\* Client name, list of \`\[{sku, quantity, price}\]\`.  
    \*   \*Logic:\* Generates unique \`B2B-XXX\` ID. Inserts into \`Orders\` (type: B2B, status: PENDING\_PACKING). Inserts into \`Order\_Items\`.  
\*   \*\*\`GET /api/orders/b2b/list\`\*\*  
    \*   \*Logic:\* Returns Orders where \`type \== B2B\`.  
\*   \*\*\`PUT /api/orders/b2b/{id}/payment\`\*\*  
    \*   \*Logic:\* Updates \`payment\_status\` to \`PAID\`.

\#\# 5\. Frontend Requirements (Vanilla JS)  
\*   \*\*State Management:\*\* No frameworks. Create a global \`api.js\` fetch wrapper that automatically injects \`Authorization: Bearer \<token\>\` into headers.  
\*   \*\*Error Handling:\*\* The fetch wrapper must catch \`401/403\` (redirect to login) and display backend error messages (e.g., \`409 Conflict: Insufficient Stock\`) as alert popups.  
\*   \*\*Tablet Optimization:\*\* The Packer's HTML/CSS (\`packer\_tablet.html\`) must use large, touch-friendly targets with a simple two-tab toggle UI (\`À Réceptionner\` / \`À Préparer\`).

\#\# 6\. Operational Constraints & Resilience (Crucial Day 1 Details)  
1\.  \*\*Day 1 Deployment (Seed Script):\*\* You MUST write a standalone \`seed.py\` script. The system requires one of each role to function. The script should programmatically insert 4 initial users (Othmane, Karime, Mehdi, Packer) with their respective roles and hashed passwords into the database so the team can actually log in on Day 1\.  
2\.  \*\*Reverse Logistics (Returns):\*\* Returns are handled by Karime via the \`POST /api/inventory/adjust\` endpoint. Ensure this endpoint accepts positive integers (e.g., \+1) to add healthy returned stock back to \`global\_stock\`, and logs it as \`RETURN\_IN\` in the \`Stock\_Ledger\`.  
3\.  \*\*API Resilience (The Matchmaker):\*\* The Digylog/Google Sheets background sync worker must be wrapped in robust \`try/except\` blocks. If Digylog servers go down, or Google Sheets rate limits the application, it must NOT crash the FastAPI server. It should quietly log the exception and wait for the next 30-minute cron cycle to try again.

\#\# 7\. Execution Steps for AI Agent  
1\.  \*\*Step 1:\*\* Initialize the FastAPI app and create \`app/models/models.py\`. Build the SQLAlchemy tables and run the initial setup/migrations.  
2\.  \*\*Step 2:\*\* Write and execute the \`seed.py\` script to generate the 4 required login accounts. Ask for human review of the models before proceeding.  
3\.  \*\*Step 3:\*\* Implement JWT Authentication in \`app/core/security.py\` and \`app/api/dependencies.py\`.  
4\.  \*\*Step 4:\*\* Build the API endpoints route by route (Auth \-\> Finance \-\> Warehouse \-\> Packer \-\> B2B).  
5\.  \*\*Step 5:\*\* Write the resilient \`matchmaker.py\` background worker with strict error catching.  
6\.  \*\*Step 6:\*\* Construct the HTML/CSS layouts.  
7\.  \*\*Step 7:\*\* Write the Vanilla JS fetch calls to connect the UI to the FastAPI routes.

