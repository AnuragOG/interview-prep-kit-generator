import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/auth";
import { localStore } from "@/lib/db/mongodb";
import { llmClient, LLMClient } from "@/lib/llm/provider";
import { PrepKit } from "@/types/kit";

export interface MockEvaluationResult {
  score: number; // 1 to 10
  verdict: "Strong Hire" | "Hire" | "Leaning Hire" | "Needs Improvement" | "Unprepared";
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  exemplaryModelAnswer: string;
  followUpQuestion: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await localStore.findKitById(params.id);
    if (!record || record.userId !== auth.userId) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    const kit: PrepKit = record.kit;
    const { questionId, candidateAnswer } = await req.json();

    if (!questionId || !candidateAnswer || typeof candidateAnswer !== "string") {
      return NextResponse.json(
        { error: "Question ID and Candidate Answer are required." },
        { status: 400 }
      );
    }

    const question = kit.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: "Question not found in this kit" }, { status: 404 });
    }

    const mappedRequirements = kit.role.requirements.filter((r) =>
      question.requirement_ids.includes(r.id)
    );

    const systemPrompt = `You are an elite Senior Staff Bar Raiser Interviewer for ${kit.source.company}, hiring a ${kit.role.seniority} ${kit.role.title}.
Assess the candidate's answer against the interview question and rubric.

EVALUATION CRITERIA:
1. Technical Depth & Correctness: Did the candidate clearly address the core mechanism, trade-offs, and scalability?
2. Structure: For behavioral, did they use STAR (Situation, Task, Action, Result)? For technical, did they start high-level and drill into details?
3. Domain Precision: Did they hit the essential concepts in the answer outline?

Return ONLY a JSON object:
{
  "score": 8, // Integer 1-10
  "verdict": "Hire", // "Strong Hire" | "Hire" | "Leaning Hire" | "Needs Improvement" | "Unprepared"
  "strengths": ["Clear explanation of concurrency...", "..."],
  "weaknesses": ["Did not mention edge-case error handling...", "..."],
  "missingConcepts": ["Database connection pooling", "..."],
  "exemplaryModelAnswer": "A crisp, top 1% response illustrating how a Staff Engineer would answer...",
  "followUpQuestion": "A realistic, probing follow-up question the interviewer would ask next."
}`;

    const userPrompt = `ROLE: ${kit.role.title} at ${kit.source.company}
QUESTION CATEGORY: ${question.category} (Difficulty: ${question.difficulty}/3)
QUESTION PROMPT: ${question.prompt}
EXPECTED ANSWER OUTLINE: ${question.answer_outline}
REQUIREMENTS TESTED: ${mappedRequirements.map((r) => `${r.text} (${r.priority})`).join(", ")}

${LLMClient.wrapUntrusted("CANDIDATE_ANSWER", candidateAnswer)}`;

    const evaluation = await llmClient.chatCompletion<MockEvaluationResult>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        response_format: { type: "json_object" },
        temperature: 0.2,
      }
    );

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to evaluate candidate answer" },
      { status: 500 }
    );
  }
}
