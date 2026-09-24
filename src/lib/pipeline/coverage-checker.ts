import { Question, Requirement } from "@/types/kit";

export interface CoverageReport {
  uncovered_requirement_ids: string[];
  uncovered_must_have_ids: string[];
  uncovered_nice_have_ids: string[];
  coverage_percentage: number;
  total_requirements: number;
  covered_count: number;
}

/**
 * Deterministic Coverage Checker (Algorithm in pure code, NOT an LLM prompt)
 * Identifies requirements that have zero questions linked to them.
 */
export function checkCoverage(
  requirements: Requirement[],
  questions: Question[]
): CoverageReport {
  if (requirements.length === 0) {
    return {
      uncovered_requirement_ids: [],
      uncovered_must_have_ids: [],
      uncovered_nice_have_ids: [],
      coverage_percentage: 100,
      total_requirements: 0,
      covered_count: 0,
    };
  }

  // Build a set of all requirement IDs mapped by at least one question
  const coveredReqIds = new Set<string>();
  for (const q of questions) {
    if (Array.isArray(q.requirement_ids)) {
      for (const reqId of q.requirement_ids) {
        coveredReqIds.add(reqId);
      }
    }
  }

  const uncovered_requirement_ids: string[] = [];
  const uncovered_must_have_ids: string[] = [];
  const uncovered_nice_have_ids: string[] = [];

  for (const req of requirements) {
    if (!coveredReqIds.has(req.id)) {
      uncovered_requirement_ids.push(req.id);
      if (req.priority === "must") {
        uncovered_must_have_ids.push(req.id);
      } else {
        uncovered_nice_have_ids.push(req.id);
      }
    }
  }

  const covered_count = requirements.length - uncovered_requirement_ids.length;
  const coverage_percentage = Math.round(
    (covered_count / requirements.length) * 100
  );

  return {
    uncovered_requirement_ids,
    uncovered_must_have_ids,
    uncovered_nice_have_ids,
    coverage_percentage,
    total_requirements: requirements.length,
    covered_count,
  };
}
