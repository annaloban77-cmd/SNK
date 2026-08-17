from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NK-Контроль OCR Service", version="1.0")

_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        logger.info("Initializing PaddleOCR (PP-OCRv5, ru, lightweight)...")
        from paddleocr import PaddleOCR
        # PP-OCRv5 — отключаем тяжёлые модели doc orientation и unwarping
        _ocr = PaddleOCR(
            use_textline_orientation=True,
            lang='ru',
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
        )
        logger.info("PaddleOCR ready (lightweight)")
    return _ocr

class OcrRequest(BaseModel):
    image_base64: str

class OcrZoneRequest(BaseModel):
    image_base64: str
    x: int = 0
    y: int = 0
    w: int = 0
    h: int = 0

@app.post("/ocr")
async def ocr_endpoint(req: OcrRequest):
    try:
        from PIL import Image
        import numpy as np
        img_bytes = base64.b64decode(req.image_base64)
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img_array = np.array(img)

        ocr = get_ocr()
        # PaddleOCR 3.x: use predict() instead of ocr()
        result = ocr.predict(img_array)

        texts = []
        boxes = []
        confidences = []

        # PaddleOCR 3.x returns a list of results
        if result:
            for res in result:
                # res is a dict with 'rec_texts', 'rec_scores', 'dt_polys'
                if isinstance(res, dict):
                    rec_texts = res.get('rec_texts', [])
                    rec_scores = res.get('rec_scores', [])
                    dt_polys = res.get('dt_polys', [])
                    for i, text in enumerate(rec_texts):
                        conf = rec_scores[i] if i < len(rec_scores) else 0
                        box = dt_polys[i].tolist() if i < len(dt_polys) else []
                        texts.append(text)
                        boxes.append(box)
                        confidences.append(conf)
                elif isinstance(res, list):
                    # Fallback for older format
                    for line in res:
                        box = line[0]
                        text = line[1][0]
                        conf = line[1][1]
                        texts.append(text)
                        boxes.append(box)
                        confidences.append(conf)

        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        return {
            "text": "\n".join(texts),
            "confidence": avg_conf,
            "boxes": boxes,
            "words": [{"text": t, "box": b, "conf": c} for t, b, c in zip(texts, boxes, confidences)]
        }
    except Exception as e:
        logger.error(f"OCR error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ocr_zone")
async def ocr_zone_endpoint(req: OcrZoneRequest):
    try:
        from PIL import Image
        import numpy as np
        img_bytes = base64.b64decode(req.image_base64)
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')

        if req.w > 0 and req.h > 0:
            cropped = img.crop((req.x, req.y, req.x + req.w, req.y + req.h))
        else:
            cropped = img

        img_array = np.array(cropped)
        ocr = get_ocr()
        result = ocr.predict(img_array)

        texts = []
        boxes = []
        confidences = []

        if result:
            for res in result:
                if isinstance(res, dict):
                    rec_texts = res.get('rec_texts', [])
                    rec_scores = res.get('rec_scores', [])
                    dt_polys = res.get('dt_polys', [])
                    for i, text in enumerate(rec_texts):
                        conf = rec_scores[i] if i < len(rec_scores) else 0
                        box = dt_polys[i].tolist() if i < len(dt_polys) else []
                        adjusted_box = [[p[0] + req.x, p[1] + req.y] for p in box]
                        texts.append(text)
                        boxes.append(adjusted_box)
                        confidences.append(conf)

        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        return {
            "text": "\n".join(texts),
            "confidence": avg_conf,
            "boxes": boxes,
            "words": [{"text": t, "box": b, "conf": c} for t, b, c in zip(texts, boxes, confidences)]
        }
    except Exception as e:
        logger.error(f"OCR zone error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "paddleocr", "loaded": _ocr is not None}
