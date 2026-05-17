const HF_MODEL = "unsloth/gemma-4-E2B-it";
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
      looking_for: ["business_loan", "startup", "employment"],
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
];

function buildPrompt(msg) {
  return `<start_of_turn>user
${SYSTEM_PROMPT}

User says: ${msg}<end_of_turn>
<start_of_turn>model
`;
}

function extractFirstJson(text) {
  const cleaned = text.split("<end_of_turn>")[0].replace(/<start_of_turn>[\s\S]*/g, "").trim();
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
  return hits.length ? hits : schemes.slice(0, 3);
}

function matchLegal(cat, details) {
  const c = norm(cat);
  return legalRights.find(
    (l) =>
      norm(l.category) === c ||
      (l.issues || []).some((i) => norm(details?.issue).includes(norm(i)) || norm(i).includes(norm(details?.issue)))
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
      category: m.includes("amazon") ? "consumer" : m.includes("landlord") ? "property" : "labor",
      details: { issue: m.includes("amazon") ? "defective_product" : "unpaid_wages" },
    };
  }
  if (m.includes("kisan") || m.includes("farmer") || m.includes("taxi") || m.includes("kaam") || m.includes("dilway") || m.includes("rozgar") || m.includes("job") || m.includes("naukri")) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation: m.includes("taxi") ? "taxi_driver" : m.includes("farmer") || m.includes("kisan") ? "farmer" : "unemployed",
        looking_for: "employment",
      },
    };
  }
  return {
    intent: "general_query",
    follow_up_hindi: "Kya problem hai? Scheme dhundh rahe ho ya legal issue? Detail batayein.",
  };
}

async function callHF(prompt) {
  const token = process.env.HF_TOKEN;
  if (!token) return null;
  try {
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
  } catch {
    return null;
  }
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
    });
  } catch (e) {
    console.error(e);
    const message = (typeof req.body === "string" ? JSON.parse(req.body) : req.body)?.message || "";
    const extraction = demoExtraction(message);
    return res.status(200).json({
      extraction,
      results: matchExtraction(extraction),
      source: "demo",
    });
  }
}
