import { readFileSync } from "fs";
import { join } from "path";

const HF_MODEL = "unsloth/gemma-4-E2B-it";
const SYSTEM_PROMPT = `You are Sahaj, an AI assistant for Indian citizens.
Your job: understand the user's input and extract structured information.
Always respond with valid JSON containing:
- "intent": one of ["scheme_discovery", "legal_aid", "document_scan", "general_query"]
- relevant extracted fields based on intent

Do NOT suggest specific schemes or laws. Only extract the user's profile/situation.`;

const schemes = JSON.parse(readFileSync(join(process.cwd(), "api/data/schemes.json"), "utf8"));
const legalRights = JSON.parse(readFileSync(join(process.cwd(), "api/data/legal_rights.json"), "utf8"));

function buildPrompt(msg) {
  return `<start_of_turn>user
${SYSTEM_PROMPT}

User says: ${msg}<end_of_turn>
<start_of_turn>model
`;
}

function extractFirstJson(text) {
  let cleaned = text.split("<end_of_turn>")[0].replace(/<start_of_turn>[\s\S]*/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function norm(s) {
  if (s == null) return "";
  return String(s).toLowerCase().replace(/\s+/g, "_");
}

function matchList(v, allowed) {
  if (!allowed?.length) return true;
  const n = norm(v);
  if (!n) return false;
  return allowed.some((a) => n.includes(norm(a)) || norm(a).includes(n));
}

function matchSchemes(profile) {
  const hits = [];
  for (const s of schemes) {
    const e = s.eligibility || {};
    let ok = true;
    if (e.occupation) ok = ok && matchList(profile.occupation, e.occupation);
    if (e.income_category) ok = ok && matchList(profile.income_category, e.income_category);
    if (e.looking_for) ok = ok && matchList(profile.looking_for ?? profile.need, e.looking_for);
    if (e.area) ok = ok && matchList(profile.area, e.area);
    if (typeof e.max_land_acres === "number" && typeof profile.land_acres === "number") {
      ok = ok && profile.land_acres <= e.max_land_acres;
    }
    if (ok && Object.keys(e).length) hits.push(s);
  }
  return hits.length ? hits : schemes.slice(0, 3);
}

function matchLegal(cat, details) {
  const c = norm(cat);
  return legalRights.find(
    (l) =>
      norm(l.category) === c ||
      l.issues?.some((i) => norm(details.issue).includes(norm(i)) || norm(i).includes(norm(details.issue)))
  );
}

function matchExtraction(data) {
  const intent = norm(data.intent);
  if (intent === "scheme_discovery") {
    return { type: "schemes", schemes: matchSchemes(data.profile || {}) };
  }
  if (intent === "legal_aid") {
    const legal = matchLegal(data.category || "", data.details || {});
    return {
      type: "legal",
      legal,
      message: legal ? undefined : "हमने आपकी समस्या नोट कर ली है।",
    };
  }
  if (intent === "document_scan") {
    return { type: "document", message: "दस्तावेज़ स्कैन — जल्द उपलब्ध।" };
  }
  return {
    type: "general",
    message: data.follow_up_hindi || "Scheme ya legal issue — detail batayein.",
  };
}

function demoExtraction(message) {
  const m = message.toLowerCase();
  if (m.includes("amazon") || m.includes("refund") || m.includes("landlord") || m.includes("salary")) {
    return {
      intent: "legal_aid",
      category: m.includes("amazon") ? "consumer" : m.includes("landlord") ? "property" : "labor",
      details: { issue: m.includes("amazon") ? "defective_product" : "unpaid_wages" },
    };
  }
  if (m.includes("kisan") || m.includes("farmer") || m.includes("taxi") || m.includes("loan")) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation: m.includes("taxi") ? "taxi_driver" : "farmer",
        state: m.includes("jaipur") || m.includes("rajasthan") ? "Rajasthan" : undefined,
        looking_for: "business_loan",
      },
    };
  }
  return {
    intent: "general_query",
    follow_up_hindi: "Kya problem hai? Scheme ya legal issue?",
  };
}

async function callHF(prompt) {
  const token = process.env.HF_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 400, temperature: 0.15, return_full_text: false },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
  if (data?.generated_text) return data.generated_text;
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const prompt = buildPrompt(message.trim());
    let raw = await callHF(prompt);
    let source = "hf";
    if (!raw) {
      source = "demo";
      raw = JSON.stringify(demoExtraction(message));
    }
    let extraction = extractFirstJson(raw);
    if (!extraction) {
      source = "demo";
      extraction = demoExtraction(message);
    }

    return res.status(200).json({
      extraction,
      results: matchExtraction(extraction),
      source,
      model: HF_MODEL,
      lora_note: "Fine-tuned: smrtnetizen/sahaj-lora (Gemma 4 E2B)",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
}
