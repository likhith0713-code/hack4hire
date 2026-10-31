FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY index.html tsconfig.json vite.config.ts app.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY api ./api
COPY alembic.ini ./
COPY alembic ./alembic
COPY --from=frontend /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "python3 -m uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-3000}"]
