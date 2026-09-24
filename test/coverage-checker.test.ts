import { describe, it, expect } from "vitest";
import { checkCoverage } from "../src/lib/pipeline/coverage-checker";
import { Question, Requirement } from "../src/types/kit";

describe("Deterministic Coverage Checker", () => {
  const reqs: Requirement[] = [
    { id: "r1", text: "React & TypeScript", kind: "technical", priority: "must" },
    { id: "r2", text: "PostgreSQL & Database Indexing", kind: "technical", priority: "must" },
    { id: "r3", text: "Cross-team communication", kind: "behavioural", priority: "nice" },
  ];

  it("should report 100% coverage when all requirements are mapped by questions", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "r2"],
        category: "technical",
        prompt: "...",
        answer_outline: "...",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "...",
        answer_outline: "...",
        difficulty: 1,
      },
    ];

    const report = checkCoverage(reqs, questions);
    expect(report.coverage_percentage).toBe(100);
    expect(report.uncovered_requirement_ids.length).toBe(0);
    expect(report.uncovered_must_have_ids.length).toBe(0);
  });

  it("should correctly identify uncovered must-have vs nice-to-have requirements", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "...",
        answer_outline: "...",
        difficulty: 2,
      },
    ];

    const report = checkCoverage(reqs, questions);
    expect(report.coverage_percentage).toBe(33);
    expect(report.uncovered_requirement_ids).toEqual(["r2", "r3"]);
    expect(report.uncovered_must_have_ids).toEqual(["r2"]);
    expect(report.uncovered_nice_have_ids).toEqual(["r3"]);
  });

  it("should handle empty requirement list gracefully", () => {
    const report = checkCoverage([], []);
    expect(report.coverage_percentage).toBe(100);
    expect(report.uncovered_requirement_ids).toEqual([]);
  });
});
