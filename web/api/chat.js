// Same family you trained on (Gemma 4). Override in Vercel: HF_MODEL=unsloth/gemma-4-E2B-it
// Note: sahaj-lora is LoRA weights — HF needs full model or Inference Endpoint, not adapter-only repo.
const HF_MODEL = process.env.HF_MODEL || "unsloth/gemma-4-E2B-it";
const SYSTEM_PROMPT = `You are Sahaj, an AI assistant for Indian citizens.
Your job: understand the user's input and extract structured information.
Always respond with valid JSON containing:
- "intent": one of ["scheme_discovery", "legal_aid", "document_scan", "general_query"]
- relevant extracted fields based on intent

Do NOT suggest specific schemes or laws. Only extract the user's profile/situation.`;

const schemes = [
  {
    id: "pm-kisan",
    name: "PM-KISAN",
    name_hindi: "प्रधानमंत्री किसान सम्मान निधि",
    description_hindi: "छोटे किसानों को साल में ₹6,000 की आर्थिक सहायता।",
    benefit_amount: "₹6,000/year",
    portal_url: "https://pmkisan.gov.in",
    eligibility: { occupation: ["farmer"], max_land_acres: 5 },
  },
  {
    id: "pm-mudra",
    name: "PM Mudra Yojana",
    name_hindi: "प्रधानमंत्री मुद्रा योजना",
    description_hindi: "छोटे व्यवसाय के लिए ऋण।",
    benefit_amount: "Up to ₹10 lakh",
    portal_url: "https://www.mudra.org.in",
    eligibility: {
      looking_for: ["business_loan", "startup", "business"],
      occupation: ["aspiring_entrepreneur", "street_vendor", "unemployed"],
    },
  },
  {
    id: "ayushman",
    name: "Ayushman Bharat",
    name_hindi: "आयुष्मान भारत",
    description_hindi: "परिवार को ₹5 लाख तक का स्वास्थ्य बीमा।",
    benefit_amount: "₹5 lakh/family",
    portal_url: "https://pmjay.gov.in",
    eligibility: { income_category: ["BPL", "LIG"] },
  },
  {
    id: "mgnrega",
    name: "MGNREGA",
    name_hindi: "मनरेगा",
    description_hindi: "ग्रामीण क्षेत्रों में रोजगार की गारंटी।",
    benefit_amount: "100 days employment",
    portal_url: "https://nrega.nic.in",
    eligibility: { area: ["rural"], occupation: ["landless_laborer", "unemployed"] },
  },
];

const legalRights = [
  {
    category: "labor",
    title_hindi: "श्रम अधिकार",
    laws: ["Payment of Wages Act, 1936"],
    steps_hindi: ["Documents इकट्ठा करें", "Labour Commissioner को शिकायत", "Legal aid clinic"],
    portal_url: "https://labour.gov.in",
    issues: ["unpaid_wages", "wrongful_termination", "workplace_injury"],
  },
  {
    category: "consumer",
    title_hindi: "उपभोक्ता अधिकार",
    laws: ["Consumer Protection Act, 2019"],
    steps_hindi: ["Proof सेव करें", "consumerhelpline.gov.in पर शिकायत"],
    portal_url: "https://consumerhelpline.gov.in",
    issues: ["defective_product", "refund_denied", "bank_fraud"],
  },
  {
    category: "property",
    title_hindi: "संपत्ति / किराया",
    laws: ["Rent control acts"],
    steps_hindi: ["Agreement copy रखें", "Legal notice", "Civil court"],
    portal_url: "",
    issues: ["eviction_without_notice", "eviction_notice", "tenant_not_paying"],
  },
  {
    category: "women",
    title_hindi: "महिला सुरक्षा और कानूनी अधिकार",
    laws: ["BNS (sexual offences)", "Domestic Violence Act, 2005"],
    steps_hindi: ["112 / 181 helpline", "FIR", "Medical exam", "NALSA free lawyer"],
    portal_url: "https://wcd.nic.in",
    issues: ["sexual_assault", "rape", "domestic_violence"],
  },
];

function extractFirstJson(text) {
  const cleaned = String(text).split("<end_of_turn>")[0].trim();
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
    if (e.looking_for) ok = ok && matchList(profile.looking_for ?? profile.need, e.looking_for);
    if (e.area) ok = ok && matchList(profile.area, e.area);
    if (e.income_category) ok = ok && matchList(profile.income_category, e.income_category);
    if (ok && Object.keys(e).length) hits.push(s);
  }
  return hits;
}

function matchLegal(cat, details) {
  const c = norm(cat);
  const issue = norm(details?.issue);
  if (c) {
    const byCat = legalRights.find((l) => norm(l.category) === c);
    if (byCat) return byCat;
  }
  if (issue) {
    return legalRights.find((l) =>
      (l.issues || []).some((i) => issue === norm(i) || issue.includes(norm(i)) || norm(i).includes(issue))
    );
  }
  return undefined;
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
      message: legal ? undefined : "हमने आपकी समस्या नोट कर ली है। कृपया और विवरण दें।",
    };
  }
  if (intent === "document_scan") {
    return { type: "document", message: "दस्तावेज़ स्कैन जल्द उपलब्ध होगा।" };
  }
  return {
    type: "general",
    message: data.follow_up_hindi || "Scheme ya legal issue — detail batayein.",
  };
}

function demoExtraction(message) {
  const m = message.toLowerCase();
  if (m.includes("amazon") || m.includes("refund") || m.includes("landlord") || m.includes("salary") || m.includes("malik")) {
    return {
      intent: "legal_aid",
      category: m.includes("amazon") || m.includes("refund") ? "consumer" : m.includes("landlord") ? "property" : "labor",
      details: {
        issue: m.includes("amazon") ? "defective_product" : m.includes("landlord") ? "eviction_without_notice" : "unpaid_wages",
      },
    };
  }
  if (m.includes("blind") || m.includes("andha") || m.includes("disabilit") || m.includes("viklang")) {
    return {
      intent: "scheme_discovery",
      profile: {
        state: m.includes("assam") ? "Assam" : undefined,
        looking_for: "health_scheme",
        disability: "visual_impairment",
      },
    };
  }
  if (m.includes("kisan") || m.includes("farmer") || m.includes("kaam") || m.includes("scheme") || m.includes("startup") || m.includes("naukri")) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation: m.includes("farmer") || m.includes("kisan") ? "farmer" : "unemployed",
        state: m.includes("assam") ? "Assam" : undefined,
        looking_for: m.includes("startup") ? "startup" : "employment",
      },
    };
  }
  return { intent: "general_query", follow_up_hindi: "Scheme ya legal issue — detail batayein." };
}

async function callHF(userText) {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) return { error: "HF_TOKEN missing on server" };

  const models = [
    ...new Set(
      [
        HF_MODEL,
        "unsloth/gemma-4-E2B-it",
        "google/gemma-4-e4b-it",
        "meta-llama/Llama-3.2-3B-Instruct:groq",
      ].filter(Boolean)
    ),
  ];
  let lastErr = "";

  for (const model of models) {
    try {
      const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userText },
          ],
          max_tokens: 400,
          temperature: 0.15,
        }),
      });
      const body = await res.text();
      if (!res.ok) {
        lastErr = `${model}: ${res.status} ${body.slice(0, 200)}`;
        continue;
      }
      const data = JSON.parse(body);
      const text = data?.choices?.[0]?.message?.content;
      if (text) return { text, model };
    } catch (e) {
      lastErr = String(e);
    }
  }
  return { error: lastErr || "HF failed" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const message = body.message;
    if (!message?.trim()) return res.status(400).json({ error: "message required" });

    const contextText = (body.context || message).trim();
    const hf = await callHF(contextText);

    let source = "hf";
    let extraction = null;
    let hf_hint = hf.model ? `ok:${hf.model}` : null;

    if (hf.text) {
      extraction = extractFirstJson(hf.text);
      if (!extraction) {
        extraction = { intent: "general_query", parse_note: "Model output was not valid JSON", raw: hf.text };
      }
    } else {
      source = "demo";
      hf_hint = hf.error;
      extraction = demoExtraction(message.trim());
    }

    return res.status(200).json({
      extraction,
      results: matchExtraction(extraction),
      source,
      hf_hint,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
