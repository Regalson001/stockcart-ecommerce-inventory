# StockCart — E-Commerce & Inventory Management System

StockCart is a full-stack mini e-commerce platform with a modern
customer storefront, shopping cart, customer authentication,
order tracking and an administrator inventory dashboard.

## Features

### Customer storefront
- Responsive product catalogue
- Product search
- Category filtering
- Product images and pricing
- Shopping cart
- Quantity management
- Customer registration and login
- Checkout form
- Order history

### Inventory management
- Admin dashboard
- Add new products
- Edit existing products
- Product SKU management
- Stock quantity management
- Low-stock indicators
- Inventory summary

### Order management
- Create customer orders
- Automatic stock deduction
- Order history
- Order status management
- Cancel orders and restore stock

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript ES6+
- Local Storage
- Fetch API

### Backend
- Python
- FastAPI
- SQLAlchemy
- Pydantic
- SQLite

### Authentication
- Password hashing with PBKDF2
- Signed bearer tokens
- Role-based administrator access

## Project Structure

```text
stockcart-ecommerce-inventory/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   └── seed.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .gitignore
└── README.md
