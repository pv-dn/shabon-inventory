# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py run.py config.py database.py db_compat.py import_excel.py shabon_images.py categories.py ./
COPY templates/ templates/
COPY static/ static/
COPY data/products.json data/products.json
COPY --from=frontend /frontend/dist frontend/dist

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV OPEN_BROWSER=false
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["python", "run.py"]
