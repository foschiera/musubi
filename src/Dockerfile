FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY history ./history
COPY web ./web
USER 10001
CMD ["uvicorn", "history.api:app", "--host", "0.0.0.0", "--port", "8000"]
