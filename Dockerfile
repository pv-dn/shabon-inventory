FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py run.py config.py database.py db_compat.py import_excel.py shabon_images.py ./
COPY templates/ templates/
COPY static/ static/
COPY data/products.json data/products.json
COPY render.yaml ./

ENV PORT=10000
ENV RENDER=true
ENV PYTHONUNBUFFERED=1

EXPOSE 10000

CMD ["python", "run.py"]
