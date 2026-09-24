import { describe, it, expect } from "vitest";
import { validatePrepKit } from "../src/lib/pipeline/validator";
import { PrepKit } from "../src/types/kit";

describe("Strict Appendix A Kit Validator", () => {
  const validKit: PrepKit = {
    source: {
      company: "Acme Corp",
      company_url: "https://acme.example.com",
      role: "Senior Backend Engineer",
      location: "San Francisco, CA",
      jd_chars: 1200,
      researched_at: "2026-09-24T12:00:00.000Z",
      pages_used: ["https://acme.example.com"],
    },
    company_brief: {
      summary: "Acme Corp builds cloud analytics infrastructure.",
      what_they_do: "Enterprise data platform.",
      sources: ["https://acme.example.com"],
    },
    role: {
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Lead API architecture", "Mentor junior engineers"],
      requirements: [
        { id: "r1", text: "5+ years with Go", kind: "technical", priority: "must" },
        { id: "r2", text: "Mentoring junior engineers", kind: "behavioural", priority: "nice" },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain Go goroutine scheduling and channel synchronization.",
        answer_outline: "M:N scheduler, work stealing, unbuffered vs buffered channels.",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "behavioural",
        prompt: "Tell me about a time you mentored a junior engineer.",
        answer_outline: "Situation, pairing approach, outcome.",
        difficulty: 1,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "Go Channel Deadlock Causes",
        back: "Sending to unbuffered channel without receiver; circular waiting.",
        requirement_ids: ["r1"],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: "Technical Core", question_ids: ["q1"], minutes: 45 },
        { day: 2, focus: "Behavioural & Culture", question_ids: ["q2"], minutes: 30 },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };

  it("should validate a compliant Appendix A kit successfully", () => {
    const result = validatePrepKit(validKit);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should catch non-integer minutes in schedule", () => {
    const badKit = JSON.parse(JSON.stringify(validKit));
    badKit.schedule.days[0].minutes = 45.5; // Float minutes not allowed

    const result = validatePrepKit(badKit);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("minutes"))).toBe(true);
  });

  it("should catch non-existent question_ids referenced in schedule", () => {
    const badKit = JSON.parse(JSON.stringify(validKit));
    badKit.schedule.days[0].question_ids = ["q999_non_existent"];

    const result = validatePrepKit(badKit);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("q999_non_existent"))).toBe(true);
  });

  it("should catch invalid requirement kind or priority", () => {
    const badKit = JSON.parse(JSON.stringify(validKit));
    badKit.role.requirements[0].kind = "unknown_kind";
    badKit.role.requirements[0].priority = "optional"; // Must be 'must' or 'nice'

    const result = validatePrepKit(badKit);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("kind"))).toBe(true);
    expect(result.errors.some((e) => e.includes("priority"))).toBe(true);
  });

  it("should catch day count mismatch with days_available", () => {
    const badKit = JSON.parse(JSON.stringify(validKit));
    badKit.schedule.days_available = 5; // but only 2 days in array

    const result = validatePrepKit(badKit);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("does not match"))).toBe(true);
  });
});
