from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from .database import Base, engine, get_db
from .models import User, Product, Order, OrderItem
from .schemas import (
    UserCreate,
    LoginInput,
    ProductInput,
    ProductOut,
    CheckoutInput,
    StatusInput
)
from .auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_admin
)
from .seed import seed_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = next(get_db())
    try:
        seed_data(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title="StockCart API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "StockCart API"
    }


# -------------------------
# CUSTOMER AUTHENTICATION
# -------------------------

@app.post("/api/auth/register")
def register(data: UserCreate, db: Session = Depends(get_db)):
    email = data.email.lower()

    if db.query(User).filter_by(email=email).first():
        raise HTTPException(
            409,
            "An account with this email already exists"
        )

    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "token": create_token(user),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


@app.post("/api/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(
        email=data.email.lower()
    ).first()

    if not user or not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(401, "Incorrect email or password")

    return {
        "token": create_token(user),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }


# -------------------------
# PRODUCT CATALOGUE
# -------------------------

@app.get("/api/products", response_model=list[ProductOut])
def products(
    q: str = "",
    category: str = "",
    db: Session = Depends(get_db)
):
    query = db.query(Product)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(like),
                Product.description.ilike(like),
                Product.sku.ilike(like)
            )
        )

    if category and category.lower() != "all":
        query = query.filter(Product.category == category)

    return query.order_by(Product.id.desc()).all()


@app.get("/api/categories")
def categories(db: Session = Depends(get_db)):
    rows = (
        db.query(Product.category)
        .distinct()
        .order_by(Product.category)
        .all()
    )

    return [row[0] for row in rows]


# -------------------------
# ADMIN PRODUCT MANAGEMENT
# -------------------------

@app.post("/api/products", response_model=ProductOut)
def create_product(
    data: ProductInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    if db.query(Product).filter_by(sku=data.sku).first():
        raise HTTPException(409, "SKU already exists")

    product = Product(**data.model_dump())

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    data: ProductInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    product = db.get(Product, product_id)

    if not product:
        raise HTTPException(404, "Product not found")

    duplicate = db.query(Product).filter(
        Product.sku == data.sku,
        Product.id != product_id
    ).first()

    if duplicate:
        raise HTTPException(409, "SKU already exists")

    for key, value in data.model_dump().items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)

    return product


@app.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    product = db.get(Product, product_id)

    if not product:
        raise HTTPException(404, "Product not found")

    if db.query(OrderItem).filter_by(product_id=product_id).first():
        raise HTTPException(
            409,
            "This product is referenced by an order; set its stock to zero instead"
        )

    db.delete(product)
    db.commit()

    return {"message": "Product deleted"}


# -------------------------
# CHECKOUT AND ORDER CREATION
# -------------------------

@app.post("/api/orders")
def checkout(
    data: CheckoutInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Combine repeated product IDs so stock cannot be under-deducted.
    requested = {}

    for line in data.items:
        requested[line.product_id] = (
            requested.get(line.product_id, 0) + line.quantity
        )

    products_map = {}
    total = 0.0

    # Validate every product and quantity before changing stock.
    for product_id, quantity in requested.items():
        product = db.get(Product, product_id)

        if not product:
            raise HTTPException(
                404,
                f"Product {product_id} not found"
            )

        if product.stock < quantity:
            raise HTTPException(
                409,
                f"Not enough stock for {product.name}"
            )

        products_map[product.id] = (product, quantity)
        total += product.price * quantity

    order = Order(
        user_id=user.id,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        address=data.address,
        total=round(total, 2),
        status="Processing"
    )

    for product, quantity in products_map.values():
        product.stock -= quantity

        order.items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=product.price
            )
        )

    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "id": order.id,
        "total": order.total,
        "status": order.status,
        "created_at": order.created_at
    }


def order_json(order):
    return {
        "id": order.id,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "address": order.address,
        "total": order.total,
        "status": order.status,
        "created_at": order.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price
            }
            for item in order.items
        ]
    }


@app.get("/api/orders")
def my_orders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    orders = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter_by(user_id=user.id)
        .order_by(Order.created_at.desc())
        .all()
    )

    return [order_json(order) for order in orders]


# -------------------------
# ADMIN ORDER MANAGEMENT
# -------------------------

@app.get("/api/admin/orders")
def all_orders(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    orders = (
        db.query(Order)
        .options(joinedload(Order.items))
        .order_by(Order.created_at.desc())
        .all()
    )

    return [order_json(order) for order in orders]


@app.patch("/api/admin/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    data: StatusInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    order = db.get(Order, order_id)

    if not order:
        raise HTTPException(404, "Order not found")

    if order.status == "Cancelled" and data.status != "Cancelled":
        raise HTTPException(
            409,
            "Cancelled orders cannot be reopened"
        )

    if data.status == "Cancelled" and order.status != "Cancelled":
        for item in order.items:
            product = db.get(Product, item.product_id)

            if product:
                product.stock += item.quantity

    order.status = data.status

    db.commit()

    return {
        "message": "Order status updated",
        "status": order.status
    }


# -------------------------
# ADMIN DASHBOARD SUMMARY
# -------------------------

@app.get("/api/admin/summary")
def summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    revenue = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.status != "Cancelled")
        .scalar()
    )

    return {
        "products": db.query(Product).count(),
        "orders": db.query(Order).count(),
        "revenue": round(revenue, 2),
        "low_stock": db.query(Product).filter(
            Product.stock <= 5
        ).count(),
        "units": db.query(
            func.coalesce(func.sum(Product.stock), 0)
        ).scalar()
    }
