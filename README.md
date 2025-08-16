# 🏷️ Real-Time Auction System

A **real-time bidding auction platform** built using **Django (Backend)** and **React (Frontend)**.  
This project was developed as part of the **BVCOE Software Assignment** and also serves as an **internship/placement project**.

🌐 **Live Deployment**: [Auction System on Render](https://auction-system-38ua.onrender.com)

---

## 📌 Project Overview

The **Real-Time Auction System** enables sellers to create auctions while buyers participate in bidding dynamically.  
The system ensures **real-time updates**, **notifications**, and a **clear flow of transactions** from auction creation to invoice generation.

---

## ✨ Features

- **Auction Creation**
  - Sellers create auctions with item details, starting price, bid increment, go-live time, and duration.
  
- **Live Bidding**
  - Buyers place bids dynamically.
  - The highest bid updates instantly for all participants.
  
- **Notifications**
  - Sellers and bidders get real-time notifications when:
    - A new bid is placed.
    - Their bid is outbid.
    - Auction ends.
  
- **Seller Decision Flow**
  - At auction end, sellers can:
    - Accept the highest bid ✅
    - Reject the highest bid ❌
    - Propose a counter-offer 🔄
  - Buyers can accept/reject counter-offers.

- **Post-Auction Flow**
  - Both seller and buyer receive confirmation emails.
  - Automatic **PDF invoice generation** for successful transactions.

- **Admin Panel (Bonus)**
  - Admins can view all auctions.
  - Start/reset auctions manually.
  - Monitor users and bids in real-time.

---

## 🛠️ Tech Stack

- **Frontend:** React.js  
- **Backend:** Django + Django REST Framework  
- **Real-Time Communication:** WebSockets (Django Channels)  
- **Database:** PostgreSQL (Supabase)  
- **Cache / State Management:** Redis (Upstash)  
- **Email Service:** SendGrid  
- **Deployment:** Render (Dockerized single container)

---

## 📂 Folder Structure

```

auction-system/
│── auction\_app/           # Auction models, APIs, sockets
│── auction\_project/       # Django project configuration
│── frontend/              # React frontend (UI, components, pages)
│   ├── public/
│   └── src/
│       ├── components/
│       ├── services/
│       ├── App.js
│       └── index.js
│── manage.py
│── requirements.txt
│── Dockerfile
│── README.md

````

---

## 🚀 Running the Project Locally

### Prerequisites
- Python 3.10+  
- Node.js 18+  
- PostgreSQL Database  
- Redis (local or Upstash instance)  

### Steps

1. **Clone the Repository**
   ```bash
   git clone <YOUR_REPO_URL>
   cd auction-system
````

2. **Backend Setup**

   ```bash
   cd auction_project
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

   Backend runs on: `http://127.0.0.1:8000/`

3. **Frontend Setup**

   ```bash
   cd frontend
   npm install
   npm start
   ```

   Frontend runs on: `http://localhost:3000/`

---

## 🐳 Docker Deployment

To build and run the app in a Docker container:

```bash
docker build -t auction-system .
docker run -p 8000:8000 auction-system
```

---

## 📧 Notifications & Emails

* **In-app Notifications:**
  Live alerts for bids, outbids, counter-offers, and auction results.

* **Email Notifications:**
  Powered by **SendGrid** for buyer and seller confirmation.

* **Invoice Generation:**
  Automatic PDF invoices are sent to both parties after a successful transaction.

---

## 🔮 Future Scope

* Role-based dashboards (Admin, Seller, Buyer).
* SMS notifications using Twilio.
* Advanced analytics and reporting for auctions.
* CI/CD pipelines with GitHub Actions.
* Improved bidding history logs with visualization.

---

## 📚 Assignment Reference

This project was developed according to **BVCOE Assignment Guidelines** for
**Mini Auction System (Real-Time Bidding)**.

---

## 👤 Author

Developed by **Kunal**

---

# 🌟 Thank you for visiting the project!

```

