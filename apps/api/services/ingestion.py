import io
import uuid
from typing import Optional

import docx
import pdfplumber

from models.contract import ContractVersion


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text(filename: str, file_bytes: bytes) -> tuple[str, bool]:
    """Returns (text, extraction_ok). extraction_ok=False means poor quality."""
    lower = filename.lower()
    text = ""
    try:
        if lower.endswith(".docx"):
            text = extract_text_from_docx(file_bytes)
        elif lower.endswith(".pdf"):
            text = extract_text_from_pdf(file_bytes)
        else:
            # Try as plain text
            text = file_bytes.decode("utf-8", errors="replace")
    except Exception:
        return "", False

    if len(text.strip()) < 50:
        return text, False
    return text, True
