"""One-off script to create an admin user."""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from database import sync_engine
from models.user import User, UserRole
from services.auth import hash_password


def main():
    with Session(sync_engine) as session:
        existing = session.exec(
            select(User).where(User.email == "jpgomez@stayirrelevant.com")
        ).first()
        if existing:
            print("User already exists — updating password and ensuring admin role.")
            existing.hashed_password = hash_password("Nov2011*")
            existing.role = UserRole.admin
            existing.is_active = True
            session.add(existing)
        else:
            user = User(
                email="jpgomez@stayirrelevant.com",
                hashed_password=hash_password("Nov2011*"),
                full_name="JP Gomez",
                role=UserRole.admin,
            )
            session.add(user)
            print("Admin user created.")
        session.commit()
        print("Done.")


if __name__ == "__main__":
    main()
