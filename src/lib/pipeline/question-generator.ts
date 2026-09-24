import { LLMClient, llmClient } from "../llm/provider";
import { Question, QuestionCategory, Requirement, CompanyBrief, RoleInfo } from "@/types/kit";

export interface QuestionGenContext {
  companyName: string;
  role: RoleInfo;
  companyBrief: CompanyBrief;
}

// Generate targeted questions for a specific category and set of requirements
export async function generateCategoryQuestions(
  category: QuestionCategory,
  requirements: Requirement[],
  context: QuestionGenContext,
  startIdNumber = 1
): Promise<Question[]> {
  if (requirements.length === 0 && category !== "company-fit" && category !== "system-design") {
    return [];
  }

  const categoryInstructions: Record<QuestionCategory, string> = {
    technical: `Focus strictly on practical coding, framework architecture, concurrency, API design, debugging, performance optimizations, and language-specific nuances corresponding to the technical requirements. Avoid generic trivia; ask scenario-driven technical interview questions.`,
    behavioural: `Focus strictly on real-world engineering leadership, conflict resolution, dealing with ambiguous requirements, cross-functional collaboration, mentorship, and incident post-mortems using the STAR method (Situation, Task, Action, Result).`,
    "system-design": `Focus on scalable architecture, distributed systems trade-offs, caching, database indexing, sharding, message brokers, microservices vs monoliths, and resilience fitting the company's product domain.`,
    "company-fit": `Focus on alignment with the company's mission, customer domain, product values, engineering culture, and motivation for joining this specific team.`,
  };

  const systemPrompt = `You are a Principal Interviewer creating high-caliber interview questions for a ${context.role.seniority} ${context.role.title} candidate at ${context.companyName}.

CATEGORY FOCUS: ${category.toUpperCase()}
${categoryInstructions[category]}

RULES:
1. Every generated question MUST reference at least one valid requirement ID from the provided list in "requirement_ids".
2. "difficulty" MUST be an integer between 1 and 3:
   - 1: Fundamental concept / screening level
   - 2: Practical mid-level scenario / troubleshooting
   - 3: Complex architectural decision / edge-case deep dive / high-stakes trade-off
3. "answer_outline" MUST be an actionable blueprint (bullet points of what a top candidate should mention).
4. Do not return duplicate questions.
5. Return ONLY a JSON object:
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "prompt": "Explain how you would...",
      "answer_outline": "- First point...\n- Trade-offs of...\n- Real-world example of...",
      "difficulty": 2
    }
  ]
}`;

  const reqSummary =
    requirements.length > 0
      ? requirements
          .map((r) => `[ID: ${r.id}] (${r.priority.toUpperCase()} - ${r.kind}): ${r.text}`)
          .join("\n")
      : `General role requirements for ${context.role.title}`;

  const userPrompt = `Company: ${context.companyName}
Role: ${context.role.title} (${context.role.seniority})
Company What They Do: ${context.companyBrief.what_they_do}
Hiring Notes: ${context.companyBrief.hiring_process_notes || "Standard rounds"}

REQUIREMENTS TO COVER IN THIS CATEGORY:
${reqSummary}`;

  try {
    const res = await llmClient.chatCompletion<{
      questions: Array<{
        requirement_ids: string[];
        prompt: string;
        answer_outline: string;
        difficulty: number;
      }>;
    }>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        response_format: { type: "json_object" },
        temperature: 0.3,
      }
    );

    const validReqIds = new Set(requirements.map((r) => r.id));
    const allKnownReqIds = new Set(context.role.requirements.map((r) => r.id));

    return (res.questions || []).map((q, idx) => {
      // Validate mapped requirement IDs
      const mappedIds = (q.requirement_ids || []).filter((id) =>
        allKnownReqIds.has(id)
      );

      // If LLM returned an empty or invalid array, map to the closest requirement in this batch
      if (mappedIds.length === 0 && requirements.length > 0) {
        mappedIds.push(requirements[idx % requirements.length].id);
      }

      const diff = Math.min(3, Math.max(1, Math.round(Number(q.difficulty) || 2))) as 1 | 2 | 3;

      return {
        id: `q${startIdNumber + idx}`,
        requirement_ids: mappedIds,
        category,
        prompt: q.prompt?.trim() || `Interview question for ${category}`,
        answer_outline: q.answer_outline?.trim() || "Provide clear STAR response or technical design.",
        difficulty: diff,
        origin: "generated",
        pinned: false,
      };
    });
  } catch (err: any) {
    // Fallback question generation if LLM call fails
    return requirements.slice(0, 2).map((r, idx) => ({
      id: `q${startIdNumber + idx}`,
      requirement_ids: [r.id],
      category,
      prompt: `How have you practically applied ${r.text} in past production systems?`,
      answer_outline: `- Explain architectural context\n- Detail concrete implementation\n- Highlight metrics and lessons learned`,
      difficulty: 2,
      origin: "generated",
      pinned: false,
    }));
  }
}
