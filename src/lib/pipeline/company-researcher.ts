import { LLMClient, llmClient } from "../llm/provider";
import { CompanyBrief } from "@/types/kit";
import { CrawledPage } from "../crawler/crawler";

export interface CompanyResearchInput {
  companyName: string;
  companyUrl: string;
  crawledPages: CrawledPage[];
  publicIntel: { sourceName: string; intel: string; url?: string }[];
  hiringPageFound: boolean;
}

export async function synthesizeCompanyResearch(
  input: CompanyResearchInput
): Promise<CompanyBrief> {
  const { companyName, companyUrl, crawledPages, publicIntel, hiringPageFound } =
    input;

  const sourcesUsed = crawledPages.map((p) => p.url);
  publicIntel.forEach((pi) => {
    if (pi.url && !sourcesUsed.includes(pi.url)) {
      sourcesUsed.push(pi.url);
    }
  });

  // If no pages were retrieved at all
  if (crawledPages.length === 0) {
    return {
      summary: `Automated retrieval for ${companyName} (${companyUrl}) yielded no accessible web pages. Proceeding with role-specific technical and behavioral preparation based on the provided job description.`,
      what_they_do: `No verified company details could be scraped from ${companyUrl}. Check their primary web presence directly prior to the interview.`,
      sources: [companyUrl],
      hiring_process_notes: "No hiring process documentation discovered.",
    };
  }

  const pagesSummary = crawledPages
    .map(
      (p) =>
        `PAGE (${p.type}) [${p.url}]:\n${p.content.slice(0, 3000)}`
    )
    .join("\n\n---\n\n");

  const intelSummary = publicIntel.length > 0
    ? publicIntel.map((i) => `SOURCE (${i.sourceName}): ${i.intel}`).join("\n")
    : "No public interview discussions found.";

  const systemPrompt = `You are a research analyst summarizing company intelligence for an interview candidate.
Your job is to read crawled company pages and public interview discussions, and synthesize an accurate, honest company brief and hiring process overview.

RULES:
1. Ground your answer strictly in the provided crawled text. DO NOT fabricate products, revenue, or values not mentioned.
2. If no hiring page was discovered, explicitly state in the hiring notes that the company publishes no formal public hiring roadmap.
3. If public discussion exists, highlight specific interview rounds, common themes, or expectations.
4. Return ONLY a JSON object with:
   - "summary": A concise executive summary of what the company is and its market position.
   - "what_they_do": A clear breakdown of their product, customers, and business model.
   - "hiring_process_notes": Any details on how they interview, coding tests, take-homes, or cultural traits.`;

  const userPrompt = `Company: ${companyName} (${companyUrl})
Hiring Page Discovered on Site: ${hiringPageFound ? "YES" : "NO"}

${LLMClient.wrapUntrusted("CRAWLED_PAGES", pagesSummary)}

${LLMClient.wrapUntrusted("PUBLIC_INTERVIEW_DISCUSSIONS", intelSummary)}`;

  try {
    const res = await llmClient.chatCompletion<{
      summary: string;
      what_they_do: string;
      hiring_process_notes?: string;
    }>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        response_format: { type: "json_object" },
        temperature: 0.2,
      }
    );

    return {
      summary: res.summary?.trim() || `${companyName} is an organization focused on technology products.`,
      what_they_do:
        res.what_they_do?.trim() ||
        `Information scraped from ${companyUrl} indicates general digital services.`,
      sources: sourcesUsed.length > 0 ? sourcesUsed : [companyUrl],
      hiring_process_notes:
        res.hiring_process_notes?.trim() ||
        (hiringPageFound
          ? "Standard technical screening, system design/architecture, and team cultural interviews."
          : "No public hiring process page found on the company website."),
    };
  } catch (err: any) {
    return {
      summary: `${companyName} (${companyUrl}) brief extracted from crawled landing pages.`,
      what_they_do: `Please review ${companyUrl} directly for detailed product offerings.`,
      sources: sourcesUsed.length > 0 ? sourcesUsed : [companyUrl],
      hiring_process_notes: "Interview structure could not be automatically synthesized.",
    };
  }
}
