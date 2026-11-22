import os
from sqlalchemy.orm import Session

from .models import Product, User
from .auth import hash_password


SAMPLES = [
    (
        "Studio Headphones",
        "Wireless over-ear headphones with rich, balanced sound.",
        "Electronics",
        89.00,
        24,
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900",
        "ST-HEAD-001"
    ),
    (
        "Everyday Backpack",
        "A clean, durable backpack for work and weekend travel.",
        "Accessories",
        54.50,
        18,
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900",
        "ST-BAG-002"
    ),
    (
        "Minimal Desk Lamp",
        "Warm dimmable lighting with a compact modern profile.",
        "Home",
        42.00,
        9,
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900",
        "ST-LAMP-003"
    ),
    (
        "Ceramic Coffee Set",
        "A handcrafted two-piece ceramic coffee set.",
        "Home",
        31.00,
        32,
        "https://images.unsplash.com/photo-1514228742587-6b1558f04b33?w=900",
        "ST-CUP-004"
    ),
    (
        "Classic Wristwatch",
        "A versatile everyday watch with a timeless silhouette.",
        "Accessories",
        119.00,
        6,
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900",
        "ST-WATCH-005"
    ),
    (
        "Running Sneakers",
        "Lightweight trainers designed for everyday movement.",
        "Fashion",
        76.00,
        14,
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900",
        "ST-SHOE-006"
    )
]


def seed_data(db: Session):
    if db.query(Product).count() == 0:
        for name, desc, category, price, stock, image, sku in SAMPLES:
            db.add(Product(
                name=name,
                description=desc,
                category=category,
                price=price,
                stock=stock,
                image_url=image,
                sku=sku
            ))

    email = os.getenv("ADMIN_EMAIL", "admin@stockcart.local")

    if not db.query(User).filter_by(email=email).first():
        db.add(User(
            name="StockCart Admin",
            email=email,
            password_hash=hash_password(
                os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
            ),
            role="admin"
        ))

    db.commit()
