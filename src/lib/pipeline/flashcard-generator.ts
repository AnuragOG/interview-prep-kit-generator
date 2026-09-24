import { LLMClient, llmClient } from "../llm/provider";
import { Flashcard, Requirement, RoleInfo } from "@/types/kit";

export async function generateFlashcards(
  role: RoleInfo,
  companyName: string
): Promise<Flashcard[]> {
  if (role.requirements.length === 0) {
    return [];
  }

  const systemPrompt = `You are an expert technical interviewer crafting high-yield active-recall flashcards for interview preparation.

RULES:
1. "front": A concise, punchy prompt or scenario question to test immediate recall of a key concept.
2. "back": A high-signal, bulleted answer outline (3-5 key takeaways, edge-cases, or core principles).
3. "requirement_ids": Must reference the exact requirement ID(s) it addresses.
4. Return ONLY a JSON object:
{
  "flashcards": [
    {
      "requirement_ids": ["r1"],
      "front": "What is the difference between React useMemo and useCallback?",
      "back": "- useMemo caches the result of a function execution.\n- useCallback caches the function definition itself between renders.\n- Overuse causes memory overhead; use only for expensive computations or referential equality."
    }
  ]
}`;

  const reqSummary = role.requirements
    .map((r) => `[${r.id}] (${r.priority} ${r.kind}): ${r.text}`)
    .join("\n");

  const userPrompt = `Role: ${role.title} (${role.seniority}) at ${companyName}
Generate 1-2 rapid-recall flashcards for each of the following requirements:
${reqSummary}`;

  try {
    const res = await llmClient.chatCompletion<{
      flashcards: Array<{
        requirement_ids: string[];
        front: string;
        back: string;
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

    const validReqIds = new Set(role.requirements.map((r) => r.id));

    return (res.flashcards || []).map((fc, idx) => {
      const mappedIds = (fc.requirement_ids || []).filter((id) =>
        validReqIds.has(id)
      );
      if (mappedIds.length === 0 && role.requirements.length > 0) {
        mappedIds.push(role.requirements[idx % role.requirements.length].id);
      }

      return {
        id: `f${idx + 1}`,
        front: fc.front?.trim() || "Core Technical Concept",
        back: fc.back?.trim() || "Key architectural and implementation details.",
        requirement_ids: mappedIds,
        origin: "generated",
        pinned: false,
      };
    });
  } catch (err: any) {
    // Fallback flashcards
    return role.requirements.map((r, idx) => ({
      id: `f${idx + 1}`,
      front: `Key principles and trade-offs of ${r.text}`,
      back: `- Core definition & purpose\n- Real-world production tradeoffs\n- Failure modes and mitigation`,
      requirement_ids: [r.id],
      origin: "generated",
      pinned: false,
    }));
  }
}
