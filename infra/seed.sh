#!/bin/bash
set -e
echo "Seeding database..."
cd /app || cd "$(dirname "$0")/../apps/api"
python seed.py
echo "Seed complete."
