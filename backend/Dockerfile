FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

RUN mkdir -p /data/uploads /data/posts

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
