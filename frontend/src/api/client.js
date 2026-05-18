const API_BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export function getHealth() {
  return request("/api/health");
}

export function postChat(text, sessionProfile = null, sessionContext = null) {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      text,
      session_profile: sessionProfile && Object.keys(sessionProfile).length ? sessionProfile : null,
      session_context: sessionContext && Object.keys(sessionContext).length ? sessionContext : null,
    }),
  });
}

export function postExtract(text) {
  return request("/api/extract", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function postLegalQuery(text) {
  return request("/api/legal-query", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
