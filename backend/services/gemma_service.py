import json
import re
import urllib.error
import urllib.request
from typing import Any

from config import OLLAMA_HOST, OLLAMA_MODEL, SYSTEM_PROMPT


def _try_fix_truncated_json(text: str) -> str:
    """Close unclosed braces/brackets so truncated model output can still parse."""
    opens = 0
    sq = 0
    for ch in text:
        if ch == "{":
            opens += 1
        elif ch == "}":
            opens -= 1
        elif ch == "[":
            sq += 1
        elif ch == "]":
            sq -= 1
    return text + "]" * max(sq, 0) + "}" * max(opens, 0)


def _parse_json(text: str) -> dict[str, Any] | None:
    text = re.sub(r"^Thinking\.\.\..*?(?=\{)", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*$", "", text)
    text = text.strip()
    match = re.search(r"\{.*", text, re.DOTALL)
    if not match:
        return None
    candidate = match.group().strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass
    fixed = _try_fix_truncated_json(candidate)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        return None


def _build_prompt(user_text: str, session_context: dict[str, Any] | None = None) -> str:
    utterance = user_text.strip()
    if not session_context:
        return utterance
    prev = (session_context.get("last_user_text") or "").strip()
    topic = session_context.get("last_topic")
    if not prev and not topic:
        return utterance
    ctx_parts: list[str] = []
    if prev:
        ctx_parts.append(f"Previous: {prev}")
    if topic:
        ctx_parts.append(f"Topic: {topic}")
    return f"{' | '.join(ctx_parts)} | {utterance}"


def _format_user_turn(user_text: str) -> str:
    """Match Modelfile / fine-tune: system + User says: inside the user turn."""
    return f"{SYSTEM_PROMPT.strip()}\nUser says: {user_text.strip()}"


def extract_from_text(
    user_text: str,
    session_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Call Ollama /api/generate with enough tokens for full JSON."""
    prompt = _format_user_turn(_build_prompt(user_text, session_context))

    body = json.dumps(
        {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 512, "num_ctx": 4096},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_HOST.rstrip('/')}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama unreachable at {OLLAMA_HOST}: {exc}") from exc

    raw = (data.get("response") or "").strip()
    parsed = _parse_json(raw)
    if parsed is None:
        return {"intent": "general_query", "raw_output": raw, "parse_error": True}
    return parsed
