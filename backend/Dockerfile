# Dockerfile for backend
FROM python:3.12-slim

WORKDIR /app

# Install poetry
RUN pip install poetry

# Copy only pyproject.toml and poetry.lock to leverage Docker cache
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry config virtualenvs.create false && poetry install --without dev --no-interaction --no-ansi --no-root

# Copy the rest of the application
COPY . /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
