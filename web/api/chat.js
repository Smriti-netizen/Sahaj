const HF_MODEL = process.env.HF_MODEL || "google/gemma-2-2b-it";
const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models";
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
  {
    category: "women",
    title_hindi: "महिला सुरक्षा और कानूनी अधिकार",
    laws: ["Bharatiya Nyaya Sanhita (sexual offences)", "Protection of Women from Domestic Violence Act, 2005"],
    steps_hindi: [
      "Turant 112 / 100 par call karein agar abhi khatra ho",
      "Women helpline 181 ya 1091 — 24×7 madad",
      "Nearest police station par FIR darj karwayein",
      "Government hospital mein medical examination",
      "NALSA / District Legal Services se free lawyer",
    ],
    portal_url: "https://wcd.nic.in",
    issues: ["sexual_assault", "rape", "molestation", "domestic_violence", "dowry_demand"],
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

function classifyFromMessage(message) {
  const m = message.toLowerCase().trim();
  if (/\b(rape|raped|balatkar|molest)\b/.test(m) || m.includes("rape hua")) {
    return { intent: "legal_aid", category: "women", details: { issue: "sexual_assault" } };
  }
  if (
    m.includes("landlord") ||
    m.includes("kiraya") ||
    m.includes("rent") ||
    m.includes("evict") ||
    m.includes("ghar khali") ||
    (m.includes("agreement") && (m.includes("ghar") || m.includes("rent")))
  ) {
    return {
      intent: "legal_aid",
      category: "property",
      details: {
        issue: m.includes("bina notice") || m.includes("without notice") ? "eviction_without_notice" : "eviction_notice",
      },
    };
  }
  if (m.includes("amazon") || m.includes("flipkart") || m.includes("refund") || m.includes("defective")) {
    return {
      intent: "legal_aid",
      category: "consumer",
      details: { issue: m.includes("refund") ? "refund_denied" : "defective_product" },
    };
  }
  if (m.includes("salary") || m.includes("wage") || m.includes("boss") || m.includes("nikaal")) {
    return {
      intent: "legal_aid",
      category: "labor",
      details: { issue: m.includes("salary") || m.includes("wage") ? "unpaid_wages" : "wrongful_termination" },
    };
  }
  if (m.includes("upi") || m.includes("cyber") || m.includes("fraud")) {
    return { intent: "legal_aid", category: "cyber", details: { issue: "upi_fraud" } };
  }
  if (m.includes("kisan") || m.includes("farmer") || m.includes("kaam") || m.includes("scheme") || m.includes("naukri")) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation: m.includes("farmer") || m.includes("kisan") ? "farmer" : "unemployed",
        looking_for: "employment",
      },
    };
  }
  return null;
}

function refineExtraction(message, data) {
  const fromMsg = classifyFromMessage(message);
  if (fromMsg) return { ...data, ...fromMsg };
  return data;
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
  return (
    classifyFromMessage(message) ?? {
      intent: "general_query",
      follow_up_hindi:
        "Namaste — main Sahaj hoon. Aapko sarkari scheme chahiye ya kisi legal problem mein madad? Hindi ya English mein apni situation likhiye.",
    }
  );
}

async function callHF(userText) {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userText },
        ],
        max_tokens: 400,
        temperature: 0.15,
      }),
    });
    if (!res.ok) {
      console.error("HF failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("HF error:", e);
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

    const contextText = (body.context || message).trim();
    const currentMsg = message.trim();
    let raw = await callHF(contextText);
    let source = "hf";
    if (!raw) {
      source = "demo";
      raw = JSON.stringify(demoExtraction(currentMsg));
    }
    let extraction = extractFirstJson(raw);
    if (!extraction) {
      source = "demo";
      extraction = demoExtraction(currentMsg);
    }
    extraction = refineExtraction(currentMsg, extraction);

    return res.status(200).json({
      extraction,
      results: matchExtraction(extraction),
      source,
    });
  } catch (e) {
    console.error(e);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const message = body.message || "";
    const currentMsg = (body.message || "").trim();
    const extraction = refineExtraction(currentMsg, demoExtraction(currentMsg));
    return res.status(200).json({
      extraction,
      results: matchExtraction(extraction),
      source: "demo",
    });
  }
}
