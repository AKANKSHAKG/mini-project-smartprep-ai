import json
import re
import requests
from requests.exceptions import RequestException
import os
from dotenv import load_dotenv

load_dotenv()

# Use the port where Ollama is actually running
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")

def _extract_text_from_json(data):
    if not data:
        return None
    # Ollama streaming uses "response"
    if isinstance(data, dict) and "response" in data:
        return data["response"]
    # openai-like choices -> message -> content
    if isinstance(data, dict):
        if "choices" in data and len(data["choices"]) > 0:
            c = data["choices"][0]
            if isinstance(c, dict):
                msg = c.get("message")
                if isinstance(msg, dict) and "content" in msg:
                    return msg["content"]
                if "text" in c:
                    return c["text"]
                if "content" in c:
                    return c["content"]
        if "text" in data:
            return data["text"]
        if "content" in data:
            return data["content"]
    # list of parts
    if isinstance(data, list):
        parts = []
        for item in data:
            if isinstance(item, dict):
                p = _extract_text_from_json(item)
                if p:
                    parts.append(p)
            elif isinstance(item, str):
                parts.append(item)
        if parts:
            return "\n".join(parts)
    return None

def _normalize_joined_text(raw: str) -> str:
    """
    Normalize a joined stream of token fragments into readable text.
    """
    if not raw:
        return raw
    # collapse all whitespace (including newlines/tabs) to single spaces
    s = re.sub(r'\s+', ' ', raw)
    # remove space before punctuation (e.g. "word ." -> "word.")
    s = re.sub(r'\s+([.,;:!?%)])', r'\1', s)
    # remove space after opening brackets/parentheses (e.g. "( word" -> "(word")
    s = re.sub(r'([(\[\{])\s+', r'\1', s)
    # remove space before possessive/apostrophes if any weird splits (e.g. "it ' s" -> "it's")
    s = re.sub(r"\s+'\s+", "'", s)
    # strip edges
    return s.strip()

def _format_as_bullets(text: str, max_sentences_per_bullet: int = 2) -> str:
    """
    Convert free-form text into a neat bullet-point list with blank lines between bullets.
    """
    if not text:
        return text

    # If it already contains visible bullets, return normalized text
    if re.search(r'^\s*[-*•]\s+', text, flags=re.MULTILINE):
        return text.strip()

    # Normalize whitespace first
    t = _normalize_joined_text(text)

    # split into sentences (keeps the punctuation)
    sentences = re.split(r'(?<=[.!?])\s+', t)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return t

    bullets = []
    i = 0
    while i < len(sentences):
        group = sentences[i:i + max_sentences_per_bullet]
        bullet_text = " ".join(group).strip()
        bullet_text = bullet_text[0].upper() + bullet_text[1:] if bullet_text else bullet_text
        bullets.append(f"- {bullet_text}")
        i += max_sentences_per_bullet

    return "\n\n".join(bullets)

def _wrap_prompt_with_bullet_instruction(prompt: str) -> str:
    """
    Prepend a short instruction that makes the model answer in bullet points.
    """
    instruction = (
        "You are a helpful assistant. Answer the user's query as a clear bullet-point list.\n"
        "For each bullet: start with the key point in bold (use ** **), then give 1-2 short lines of explanation.\n"
        "Keep bullets concise and use at most 3-5 main bullet points.\n\n"
    )
    return instruction + prompt

def generate_from_ollama(prompt: str, model: str = "phi3:mini", timeout: int = 120, force_bullets: bool = True):
    """
    Generate text from local Ollama.
    - force_bullets: if True, the prompt will be wrapped with an instruction to respond in bullet points.
    """
    # If requested, wrap the prompt with an instruction asking for bullet points
    prompt_to_send = _wrap_prompt_with_bullet_instruction(prompt) if force_bullets else prompt

    payload = {
        "model": model,
        "prompt": prompt_to_send,
        "stream": False
    }
    
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
    except RequestException as e:
        raise RuntimeError(f"Ollama request failed: {e}")

    # Try the simple single-JSON case
    try:
        data = resp.json()
        extracted = _extract_text_from_json(data)
        if extracted:
            text = _normalize_joined_text(extracted)

            # If force_bullets is requested, ensure output is in bullet form (fallback formatter)
            if force_bullets:
                text = _format_as_bullets(text)
            return text

        return json.dumps(data, indent=2, ensure_ascii=False)
    except ValueError:
        # NDJSON or plain text
        raw = resp.text or ""
        lines = [line for line in raw.splitlines() if line.strip()]
        pieces = []
        for line in lines:
            try:
                j = json.loads(line)
            except Exception:
                # not JSON — treat entire line as text
                pieces.append(line)
                continue
            extracted = _extract_text_from_json(j)
            if extracted:
                pieces.append(extracted)
            else:
                # fallback: collect string values
                if isinstance(j, dict):
                    vals = [v for v in j.values() if isinstance(v, str)]
                    if vals:
                        pieces.append(" ".join(vals))
        if not pieces:
            final = _normalize_joined_text(raw)
            return _format_as_bullets(final) if force_bullets else final
        # join fragments exactly (no extra spaces): preserves tokens like "Mem" + "o"
        joined = "".join(pieces)
        joined = _normalize_joined_text(joined)
        return _format_as_bullets(joined) if force_bullets else joined