import { PrepKit } from "@/types/kit";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a PrepKit against Appendix A specification and referential integrity rules.
 */
export function validatePrepKit(kit: any): ValidationResult {
  const errors: string[] = [];

  if (!kit || typeof kit !== "object") {
    return { isValid: false, errors: ["Kit must be a non-null JSON object."] };
  }

  // 1. Validate "source"
  if (!kit.source || typeof kit.source !== "object") {
    errors.push("Missing 'source' object in kit.");
  } else {
    if (typeof kit.source.company !== "string") errors.push("source.company must be a string");
    if (typeof kit.source.company_url !== "string") errors.push("source.company_url must be a string");
    if (typeof kit.source.role !== "string") errors.push("source.role must be a string");
    if (typeof kit.source.location !== "string") errors.push("source.location must be a string");
    if (typeof kit.source.jd_chars !== "number" || !Number.isInteger(kit.source.jd_chars)) {
      errors.push("source.jd_chars must be an integer");
    }
    if (typeof kit.source.researched_at !== "string") errors.push("source.researched_at must be an ISO string");
    if (!Array.isArray(kit.source.pages_used)) errors.push("source.pages_used must be an array of strings");
  }

  // 2. Validate "company_brief"
  if (!kit.company_brief || typeof kit.company_brief !== "object") {
    errors.push("Missing 'company_brief' object in kit.");
  } else {
    if (typeof kit.company_brief.summary !== "string") errors.push("company_brief.summary must be a string");
    if (typeof kit.company_brief.what_they_do !== "string") errors.push("company_brief.what_they_do must be a string");
    if (!Array.isArray(kit.company_brief.sources)) errors.push("company_brief.sources must be an array of strings");
  }

  // 3. Validate "role"
  const requirementIds = new Set<string>();
  if (!kit.role || typeof kit.role !== "object") {
    errors.push("Missing 'role' object in kit.");
  } else {
    if (typeof kit.role.title !== "string") errors.push("role.title must be a string");
    if (typeof kit.role.seniority !== "string") errors.push("role.seniority must be a string");
    if (!Array.isArray(kit.role.responsibilities)) errors.push("role.responsibilities must be an array");

    if (!Array.isArray(kit.role.requirements)) {
      errors.push("role.requirements must be an array");
    } else {
      kit.role.requirements.forEach((req: any, idx: number) => {
        if (!req.id || typeof req.id !== "string") {
          errors.push(`Requirement at index ${idx} is missing a valid 'id'`);
        } else {
          requirementIds.add(req.id);
        }
        if (typeof req.text !== "string") {
          errors.push(`Requirement ${req.id || idx} 'text' must be a string`);
        }
        if (!["technical", "behavioural", "domain"].includes(req.kind)) {
          errors.push(`Requirement ${req.id || idx} 'kind' must be 'technical' | 'behavioural' | 'domain' (got: ${req.kind})`);
        }
        if (!["must", "nice"].includes(req.priority)) {
          errors.push(`Requirement ${req.id || idx} 'priority' must be 'must' | 'nice' (got: ${req.priority})`);
        }
      });
    }
  }

  // 4. Validate "questions"
  const questionIds = new Set<string>();
  if (!Array.isArray(kit.questions)) {
    errors.push("'questions' must be an array");
  } else {
    kit.questions.forEach((q: any, idx: number) => {
      if (!q.id || typeof q.id !== "string") {
        errors.push(`Question at index ${idx} is missing a valid 'id'`);
      } else {
        questionIds.add(q.id);
      }
      if (!Array.isArray(q.requirement_ids)) {
        errors.push(`Question ${q.id || idx} 'requirement_ids' must be an array`);
      }
      if (!["technical", "behavioural", "system-design", "company-fit"].includes(q.category)) {
        errors.push(`Question ${q.id || idx} 'category' must be technical|behavioural|system-design|company-fit (got: ${q.category})`);
      }
      if (typeof q.prompt !== "string") errors.push(`Question ${q.id || idx} 'prompt' must be a string`);
      if (typeof q.answer_outline !== "string") errors.push(`Question ${q.id || idx} 'answer_outline' must be a string`);
      if (![1, 2, 3].includes(q.difficulty) || !Number.isInteger(q.difficulty)) {
        errors.push(`Question ${q.id || idx} 'difficulty' must be an integer between 1 and 3 (got: ${q.difficulty})`);
      }
    });
  }

  // 5. Validate "flashcards"
  if (!Array.isArray(kit.flashcards)) {
    errors.push("'flashcards' must be an array");
  } else {
    kit.flashcards.forEach((fc: any, idx: number) => {
      if (!fc.id || typeof fc.id !== "string") errors.push(`Flashcard at index ${idx} is missing 'id'`);
      if (typeof fc.front !== "string") errors.push(`Flashcard ${fc.id || idx} 'front' must be a string`);
      if (typeof fc.back !== "string") errors.push(`Flashcard ${fc.id || idx} 'back' must be a string`);
      if (!Array.isArray(fc.requirement_ids)) errors.push(`Flashcard ${fc.id || idx} 'requirement_ids' must be an array`);
    });
  }

  // 6. Validate "schedule"
  if (!kit.schedule || typeof kit.schedule !== "object") {
    errors.push("Missing 'schedule' object in kit.");
  } else {
    if (typeof kit.schedule.days_available !== "number" || !Number.isInteger(kit.schedule.days_available)) {
      errors.push("schedule.days_available must be an integer");
    }
    if (!Array.isArray(kit.schedule.days)) {
      errors.push("schedule.days must be an array");
    } else {
      if (kit.schedule.days.length !== kit.schedule.days_available) {
        errors.push(`schedule.days count (${kit.schedule.days.length}) does not match schedule.days_available (${kit.schedule.days_available})`);
      }

      kit.schedule.days.forEach((day: any, idx: number) => {
        if (typeof day.day !== "number" || !Number.isInteger(day.day)) {
          errors.push(`Day at index ${idx} 'day' must be an integer`);
        }
        if (typeof day.focus !== "string") {
          errors.push(`Day ${day.day || idx} 'focus' must be a string`);
        }
        if (!Array.isArray(day.question_ids)) {
          errors.push(`Day ${day.day || idx} 'question_ids' must be an array`);
        } else {
          // Verify referential integrity
          for (const qid of day.question_ids) {
            if (!questionIds.has(qid)) {
              errors.push(`Day ${day.day || idx} references non-existent question_id: '${qid}'`);
            }
          }
        }
        if (typeof day.minutes !== "number" || !Number.isInteger(day.minutes)) {
          errors.push(`Day ${day.day || idx} 'minutes' must be an integer (got: ${day.minutes})`);
        }
      });
    }
  }

  // 7. Validate "coverage"
  if (!kit.coverage || typeof kit.coverage !== "object") {
    errors.push("Missing 'coverage' object in kit.");
  } else {
    if (!Array.isArray(kit.coverage.uncovered_requirement_ids)) {
      errors.push("coverage.uncovered_requirement_ids must be an array");
    }
    if (typeof kit.coverage.passes !== "number" || !Number.isInteger(kit.coverage.passes)) {
      errors.push("coverage.passes must be an integer");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
