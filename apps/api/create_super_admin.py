"""
Seed script to create a super_admin user (no organization).

Usage:
    python create_super_admin.py --email admin@pactly.ai --password secret123 --name "Super Admin"
"""
import argparse
import asyncio
from sqlmodel import select

from database import async_session_factory
from models.user import User, UserRole
from services.auth import hash_password


async def main(email: str, password: str, full_name: str):
    async with async_session_factory() as session:
        existing = (await session.exec(select(User).where(User.email == email))).first()
        if existing:
            print(f"User with email {email} already exists (role={existing.role}).")
            if existing.role != UserRole.super_admin:
                existing.role = UserRole.super_admin
                existing.organization_id = None
                session.add(existing)
                await session.commit()
                print(f"Updated role to super_admin.")
            return

        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=UserRole.super_admin,
            organization_id=None,
        )
        session.add(user)
        await session.commit()
        print(f"Super admin created: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create super admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Super Admin")
    args = parser.parse_args()
    asyncio.run(main(args.email, args.password, args.name))
