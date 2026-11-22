from typing import Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ProductInput(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    description: str = ""
    category: str = "General"
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    image_url: str = ""
    sku: str = Field(min_length=2, max_length=60)


class ProductOut(ProductInput):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CheckoutItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=100)


class CheckoutInput(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    customer_email: EmailStr
    address: str = Field(min_length=8, max_length=1000)
    items: list[CheckoutItem] = Field(min_length=1)


class StatusInput(BaseModel):
    status: Literal["Processing", "Shipped", "Delivered", "Cancelled"]
