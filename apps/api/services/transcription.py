"""Whisper STT transcription service."""

from __future__ import annotations

import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

MOCK_TRANSCRIPTION = (
    "Please reduce the purchase price to $340,000 and extend the closing date by two weeks."
)


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio bytes using OpenAI Whisper API.

    Returns mock text when OPENAI_API_KEY is not configured.
    """
    if not settings.openai_api_key:
        logger.info("OPENAI_API_KEY not set — returning mock transcription")
        return MOCK_TRANSCRIPTION

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            files={"file": (filename, audio_bytes)},
            data={"model": "whisper-1"},
        )
        resp.raise_for_status()
        return resp.json()["text"]
