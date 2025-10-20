FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml /app/
RUN pip install --no-cache-dir fastapi uvicorn[standard] httpx
COPY . /app
CMD ["python", "bootstrap.py"]
