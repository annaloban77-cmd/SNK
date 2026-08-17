FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    paddleocr==2.7.0.3 \
    paddlepaddle==2.5.2 \
    Pillow==10.1.0 \
    numpy

COPY ocr_service.py .

CMD ["uvicorn", "ocr_service:app", "--host", "0.0.0.0", "--port", "8100"]
