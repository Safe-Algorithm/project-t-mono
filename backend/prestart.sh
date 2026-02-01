#!/bin/bash

# Exit on error
set -e

# Wait for database to be ready
python -m app.backend_pre_start

# Run database migrations
alembic upgrade head

# Create initial data (superuser, etc.)
python -m app.initial_data
