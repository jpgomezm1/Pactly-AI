"""RBAC access check tests."""

import pytest
from models.user import User, UserRole
from services.rbac import require_roles
from fastapi import HTTPException


def _make_user(role: UserRole) -> User:
    return User(email="test@test.com", hashed_password="x", full_name="Test", role=role)


def test_admin_passes_all_roles():
    checker = require_roles(UserRole.admin, UserRole.transaction_coordinator)
    user = _make_user(UserRole.admin)
    assert checker(user) == user


def test_agent_blocked_from_admin_endpoint():
    checker = require_roles(UserRole.admin)
    user = _make_user(UserRole.buyer_agent)
    with pytest.raises(HTTPException) as exc_info:
        checker(user)
    assert exc_info.value.status_code == 403


def test_tc_allowed_for_tc_role():
    checker = require_roles(UserRole.transaction_coordinator, UserRole.admin)
    user = _make_user(UserRole.transaction_coordinator)
    assert checker(user) == user


def test_seller_blocked_from_tc_endpoint():
    checker = require_roles(UserRole.transaction_coordinator)
    user = _make_user(UserRole.seller_agent)
    with pytest.raises(HTTPException):
        checker(user)
