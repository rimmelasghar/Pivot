FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS base
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 UV_PROJECT_ENVIRONMENT=/venv PATH="/venv/bin:$PATH"
WORKDIR /app

FROM base AS prod
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY pivot_api pivot_api
RUN uv sync --locked --no-dev
EXPOSE 8000
CMD ["uvicorn", "pivot_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--ws-max-size", "65536"]

# Dev target: dev dependencies (pytest, ruff) and auto-reload.
FROM base AS dev
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project
COPY . .
RUN uv sync --locked
CMD ["uvicorn", "pivot_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
