#!/bin/bash
set -e
echo "Running Alembic migrations..."
cd /app || cd "$(dirname "$0")/../apps/api"
alembic upgrade head
echo "Migrations complete."
