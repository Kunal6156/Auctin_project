# 🏷️ Real-Time Auction System

A **real-time bidding auction platform** built using **Django (Backend)** and **React (Frontend)**.  
This project was developed as part of the **BVCOE Software Assignment** and also serves as an **internship/placement project**.

🌐 **Live Deployment**: [Auction System on Render](https://auction-system-38ua.onrender.com)

---

## 📌 Project Overview

The **Real-Time Auction System** allows sellers to create auctions and buyers to participate in bidding dynamically.  
The platform ensures **real-time bid updates**, **seller decision flows**, and **post-auction invoice generation**.

---

## ✨ Features

- **Auction Creation**
  - Sellers can create auctions with item name, description, starting price, bid increment, and duration.

- **Live Bidding**
  - Buyers place bids dynamically.
  - Highest bid updates instantly across all connected clients.

- **Notifications**
  - Real-time notifications for:
    - New bids
    - Outbids
    - Auction end

- **Seller Decision Flow**
  - At auction end, seller can:
    - Accept the highest bid ✅  
    - Reject the highest bid ❌  
    - Propose a counter-offer 🔄  

- **Post-Auction Flow**
  - Confirmation emails sent to buyer & seller.
  - Automatic PDF invoice generation.

- **Admin Panel (Bonus)**
  - Monitor auctions and users.
  - Start/reset auctions manually.

---

## 🛠️ Tech Stack

- **Frontend:** React.js  
- **Backend:** Django + Django REST Framework  
- **Real-Time:** WebSockets (Django Channels + Daphne)  
- **Database:** PostgreSQL (Supabase)  
- **Cache/State:** Redis (Upstash)  
- **Email Service:** SendGrid  
- **Deployment:** Render (Dockerized)  

---

## 📂 Project Structure

```

auction-system/
├── Dockerfile
├── requirements.txt
├── package.json
├── manage.py
├── auction\_project/
│   ├── **init**.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── auction\_app/
│   ├── **init**.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── views.py
│   ├── urls.py
│   ├── serializers.py
│   ├── consumers.py
│   └── migrations/
├── static/
│   └── build/
└── frontend/
├── package.json
├── public/
│   └── index.html
└── src/
├── index.js
├── App.js
├── components/
│   ├── AuctionCreate.js
│   ├── AuctionRoom.js
│   ├── BidForm.js
│   ├── SellerDecision.js
│   ├── AdminPanel.js
│   ├── Login.js
│   ├── Register.js
│   └── AuthWrapper.js
└── services/
├── api.js
└── websocket.js

````

---

## ⚙️ Installation & Running Locally

### Prerequisites
- Python 3.11+  
- Node.js 18+  
- PostgreSQL  
- Redis (local or Upstash)  

### 1️⃣ Clone Repository
```bash
git clone https://github.com/Kunal6156/Auctin_project
cd auction-system
````

### 2️⃣ Backend Setup

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at: `http://127.0.0.1:8000/`

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at: `http://localhost:3000/`

---

## 🐳 Docker Deployment

The project is fully containerized. To build and run:

```bash
docker build -t auction-system .
docker run -p 8000:8000 auction-system
```

This will:

* Build the React frontend → `/frontend/build`
* Collect Django static files
* Start **Daphne** ASGI server on port `8000`

---

## 📧 Notifications & Emails

* **In-app Notifications** for new bids, outbids, and auction results.
* **Email Notifications** using SendGrid.
* **Invoices** generated as PDFs using ReportLab and sent via email.

---

## 🔮 Future Scope

* Role-based dashboards (Admin, Seller, Buyer)
* SMS notifications via Twilio
* Advanced analytics & reporting
* CI/CD with GitHub Actions

---

## 📚 Assignment Reference

This project was developed as per **BVCOE Assignment Guidelines** for
**Mini Auction System (Real-Time Bidding)**.

---

## 👤 Author

Developed by **Kunal**

---

# 🌟 Thank you for visiting the project!

