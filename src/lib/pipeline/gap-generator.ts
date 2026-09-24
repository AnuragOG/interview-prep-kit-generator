import { Question, Requirement, RoleInfo, CompanyBrief } from "@/types/kit";
import { checkCoverage } from "./coverage-checker";
import { generateCategoryQuestions } from "./question-generator";

export interface MultiPassResult {
  questions: Question[];
  uncovered_requirement_ids: string[];
  passes: number;
}

/**
 * Multi-Pass Gap Resolver:
 * Iteratively closes coverage gaps until all must-haves (and reachable nice-to-haves) are covered,
 * or the maximum pass limit is reached.
 */
export async function runCoveragePasses(
  initialQuestions: Question[],
  role: RoleInfo,
  companyBrief: CompanyBrief,
  companyName: string,
  maxPasses = 3
): Promise<MultiPassResult> {
  let currentQuestions = [...initialQuestions];
  let currentPass = 1;
  let report = checkCoverage(role.requirements, currentQuestions);

  while (
    (report.uncovered_must_have_ids.length > 0 ||
      report.uncovered_nice_have_ids.length > 0) &&
    currentPass < maxPasses
  ) {
    currentPass++;

    // Find the uncovered Requirement objects
    const uncoveredReqs = role.requirements.filter((r) =>
      report.uncovered_requirement_ids.includes(r.id)
    );

    if (uncoveredReqs.length === 0) break;

    // Group uncovered requirements by their kind to generate appropriate questions
    const techGaps = uncoveredReqs.filter((r) => r.kind === "technical");
    const behavGaps = uncoveredReqs.filter((r) => r.kind === "behavioural");
    const domainGaps = uncoveredReqs.filter((r) => r.kind === "domain");

    let highestQId = currentQuestions.reduce((max, q) => {
      const num = parseInt(q.id.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);

    const context = { companyName, role, companyBrief };

    // Generate targeted questions for missing technical items
    if (techGaps.length > 0) {
      const newTech = await generateCategoryQuestions(
        "technical",
        techGaps,
        context,
        highestQId + 1
      );
      currentQuestions.push(...newTech);
      highestQId += newTech.length;
    }

    // Generate targeted questions for missing behavioural items
    if (behavGaps.length > 0) {
      const newBehav = await generateCategoryQuestions(
        "behavioural",
        behavGaps,
        context,
        highestQId + 1
      );
      currentQuestions.push(...newBehav);
      highestQId += newBehav.length;
    }

    // Generate targeted questions for missing domain items
    if (domainGaps.length > 0) {
      const newDomain = await generateCategoryQuestions(
        "company-fit",
        domainGaps,
        context,
        highestQId + 1
      );
      currentQuestions.push(...newDomain);
      highestQId += newDomain.length;
    }

    // Deterministic re-check
    report = checkCoverage(role.requirements, currentQuestions);

    // If all must-haves are covered, we can finish early
    if (report.uncovered_must_have_ids.length === 0) {
      break;
    }
  }

  // Final deterministic fallback: if after passes there is STILL any uncovered requirement,
  // deterministically synthesize a direct question so the kit NEVER ships with missing must-haves.
  if (report.uncovered_requirement_ids.length > 0) {
    let nextId = currentQuestions.length + 1;
    for (const reqId of report.uncovered_requirement_ids) {
      const req = role.requirements.find((r) => r.id === reqId);
      if (req) {
        currentQuestions.push({
          id: `q${nextId++}`,
          requirement_ids: [req.id],
          category:
            req.kind === "behavioural"
              ? "behavioural"
              : req.kind === "domain"
              ? "company-fit"
              : "technical",
          prompt: `How do you demonstrate proficiency in ${req.text}?`,
          answer_outline: `- Overview of practical experience with ${req.text}\n- Key architectural and design decisions\n- Quantifiable project outcomes and lessons learned`,
          difficulty: req.priority === "must" ? 2 : 1,
          origin: "generated",
          pinned: false,
        });
      }
    }
    // Re-verify final coverage
    report = checkCoverage(role.requirements, currentQuestions);
  }

  return {
    questions: currentQuestions,
    uncovered_requirement_ids: report.uncovered_requirement_ids,
    passes: currentPass,
  };
}
