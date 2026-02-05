"""Seed script — creates admin user + demo deal."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from database import sync_engine
from models.user import User, UserRole
from models.deal import Deal, DealAssignment
from models.audit import AuditEvent
from services.auth import hash_password


def seed():
    with Session(sync_engine) as session:
        # Check if already seeded
        existing = session.exec(select(User).where(User.email == "admin@example.com")).first()
        if existing:
            print("Already seeded. Skipping.")
            return

        # Admin
        admin = User(
            email="admin@example.com",
            hashed_password=hash_password("admin123"),
            full_name="System Admin",
            role=UserRole.admin,
        )
        session.add(admin)
        session.flush()

        # TC
        tc = User(
            email="tc@example.com",
            hashed_password=hash_password("tc123456"),
            full_name="Jane TC",
            role=UserRole.transaction_coordinator,
        )
        session.add(tc)
        session.flush()

        # Buyer Agent
        buyer = User(
            email="buyer@example.com",
            hashed_password=hash_password("buyer123"),
            full_name="Bob Buyer",
            role=UserRole.buyer_agent,
        )
        session.add(buyer)
        session.flush()

        # Seller Agent
        seller = User(
            email="seller@example.com",
            hashed_password=hash_password("seller123"),
            full_name="Sally Seller",
            role=UserRole.seller_agent,
        )
        session.add(seller)
        session.flush()

        # Demo deal
        deal = Deal(
            title="123 Palm Beach Drive — Demo Deal",
            address="123 Palm Beach Drive, Miami, FL 33101",
            description="Demo residential purchase",
            created_by=tc.id,
        )
        session.add(deal)
        session.flush()

        # Assignments
        for user, role in [(tc, "transaction_coordinator"), (buyer, "buyer_agent"), (seller, "seller_agent")]:
            session.add(DealAssignment(deal_id=deal.id, user_id=user.id, role_in_deal=role))

        session.add(AuditEvent(deal_id=deal.id, user_id=tc.id, action="deal_created", details={"title": deal.title}))

        session.commit()
        print(f"Seeded: admin, tc, buyer, seller users + demo deal ({deal.id})")
        print("Logins:")
        print("  admin@example.com / admin123")
        print("  tc@example.com / tc123456")
        print("  buyer@example.com / buyer123")
        print("  seller@example.com / seller123")


if __name__ == "__main__":
    seed()
