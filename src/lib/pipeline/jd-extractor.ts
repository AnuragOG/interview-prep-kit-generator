import { LLMClient, llmClient } from "../llm/provider";
import { Requirement, RoleInfo } from "@/types/kit";

export interface ExtractedJD {
  company: string;
  role: string;
  location: string;
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
  isStub: boolean;
}

export async function extractJDRequirements(
  jdText: string,
  companyUrl: string
): Promise<ExtractedJD> {
  const cleanJD = jdText.trim();
  const jdLength = cleanJD.length;

  // Detect thin stub JD (e.g. 2 lines / very short text)
  const isStub = jdLength < 250 || cleanJD.split("\n").filter((l) => l.trim()).length <= 3;

  const systemPrompt = `You are a precision Job Description (JD) analyzer.
Your task is to extract structured role details and exact requirements from the provided job description.

CRITICAL ASSESSMENT RULES:
1. DO NOT invent or fabricate requirements that are not in the text. If the posting is thin or brief, extract only what is genuinely stated.
2. Every requirement MUST have:
   - "id": stable identifier starting with "r1", "r2", "r3", ...
   - "text": concise, faithful summary of the requirement from the posting.
   - "kind": exactly one of "technical" | "behavioural" | "domain".
     - "technical": coding languages, frameworks, databases, cloud, system architecture, etc.
     - "behavioural": leadership, teamwork, mentoring, communication, problem solving, etc.
     - "domain": industry knowledge (e.g. fintech, healthcare, compliance, e-commerce, B2B SaaS).
   - "priority": exactly one of "must" | "nice".
     - "must": words like "required", "must have", "qualifications", "minimum", "core", "essential", "you have", or core prerequisites.
     - "nice": words like "bonus", "nice to have", "plus", "preferred", "extra points", "ideal".
3. Extract the company name, role title, seniority ("Junior", "Mid", "Senior", "Lead", "Staff", "Principal", "Intern", or "Unspecified"), location, and main responsibilities.

Return ONLY a valid JSON object in this exact schema:
{
  "company": "string",
  "title": "string",
  "seniority": "string",
  "location": "string",
  "responsibilities": ["string"],
  "requirements": [
    {
      "id": "r1",
      "text": "5+ years with React",
      "kind": "technical",
      "priority": "must"
    }
  ]
}`;

  const userPrompt = `Company Website Given: ${companyUrl}
${LLMClient.wrapUntrusted("JOB_DESCRIPTION", cleanJD)}`;

  const extracted = await llmClient.chatCompletion<{
    company: string;
    title: string;
    seniority: string;
    location: string;
    responsibilities: string[];
    requirements: Array<{
      id?: string;
      text: string;
      kind: "technical" | "behavioural" | "domain";
      priority: "must" | "nice";
    }>;
  }>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for high precision and zero fabrication
    }
  );

  // Normalize requirement IDs to ensure strict stability (r1, r2, r3...)
  const normalizedRequirements: Requirement[] = (extracted.requirements || []).map(
    (req, idx) => ({
      id: `r${idx + 1}`,
      text: req.text.trim(),
      kind: ["technical", "behavioural", "domain"].includes(req.kind)
        ? req.kind
        : "technical",
      priority: ["must", "nice"].includes(req.priority) ? req.priority : "must",
    })
  );

  // Derive company name fallback from domain if missing
  let derivedCompany = extracted.company?.trim();
  if (!derivedCompany || derivedCompany.toLowerCase() === "unknown") {
    try {
      const parsed = new URL(
        companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`
      );
      const hostParts = parsed.hostname.replace(/^www\./, "").split(".");
      derivedCompany =
        hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
    } catch {
      derivedCompany = "Target Company";
    }
  }

  return {
    company: derivedCompany,
    role: extracted.title?.trim() || "Software Engineer",
    title: extracted.title?.trim() || "Software Engineer",
    seniority: extracted.seniority?.trim() || "Mid-Level",
    location: extracted.location?.trim() || "Not specified",
    responsibilities: Array.isArray(extracted.responsibilities)
      ? extracted.responsibilities.map((r) => r.trim()).filter(Boolean)
      : [],
    requirements: normalizedRequirements,
    isStub,
  };
}
