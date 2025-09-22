# backend/llm_client.py
import json
import re
import requests
from requests.exceptions import RequestException

# Use the port your Ollama REST server is listening on
OLLAMA_URL = "http://127.0.0.1:11435/api/generate"

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
    Strategy:
      - collapse many whitespace characters into a single space
      - remove spaces before punctuation like .,;:!?%)
      - remove spaces after opening punctuation like ( [ {
      - strip leading/trailing whitespace
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

def generate_from_ollama(prompt: str, model: str = "phi3:mini", timeout: int = 120):
    payload = {
        "model": model,
        "prompt": prompt,
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
            return _normalize_joined_text(extracted)
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
            return _normalize_joined_text(raw)
        # join fragments exactly (no extra spaces): preserves tokens like "Mem" + "o"
        joined = "".join(pieces)
        return _normalize_joined_text(joined)
