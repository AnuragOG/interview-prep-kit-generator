import { describe, it, expect } from "vitest";
import { buildSchedule } from "../src/lib/pipeline/schedule-allocator";
import { Question, Requirement } from "../src/types/kit";

describe("Deterministic Schedule Allocator", () => {
  const sampleRequirements: Requirement[] = [
    { id: "r1", text: "5+ years with React", kind: "technical", priority: "must" },
    { id: "r2", text: "Distributed Systems & Kafka", kind: "technical", priority: "must" },
    { id: "r3", text: "Mentoring engineers", kind: "behavioural", priority: "nice" },
  ];

  const sampleQuestions: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Explain React 18 concurrent rendering and fiber architecture.",
      answer_outline: "Fiber nodes, work loop, concurrent features.",
      difficulty: 3,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "system-design",
      prompt: "Design a real-time event streaming pipeline using Kafka.",
      answer_outline: "Partitioning, consumer groups, offset management.",
      difficulty: 3,
    },
    {
      id: "q3",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "How do you optimize bundle size and prevent re-renders?",
      answer_outline: "Code splitting, useMemo, React.memo.",
      difficulty: 2,
    },
    {
      id: "q4",
      requirement_ids: ["r3"],
      category: "behavioural",
      prompt: "Describe a time you mentored a struggling junior developer.",
      answer_outline: "STAR approach: situation, pairing, structured goals, outcome.",
      difficulty: 1,
    },
    {
      id: "q5",
      requirement_ids: ["r1"],
      category: "company-fit",
      prompt: "Why do you want to join our engineering culture?",
      answer_outline: "Alignment with product mission and autonomy.",
      difficulty: 1,
    },
  ];

  it("should generate exact number of days requested (1, 5, 14, 30, 60 days)", () => {
    const testDayCounts = [1, 3, 5, 7, 14, 30, 60];
    for (const days of testDayCounts) {
      const schedule = buildSchedule({
        daysAvailable: days,
        questions: sampleQuestions,
        requirements: sampleRequirements,
      });

      expect(schedule.days_available).toBe(days);
      expect(schedule.days.length).toBe(days);
      expect(schedule.days[0].day).toBe(1);
      expect(schedule.days[days - 1].day).toBe(days);
    }
  });

  it("should ensure all day minutes are strictly positive integers", () => {
    const schedule = buildSchedule({
      daysAvailable: 5,
      questions: sampleQuestions,
      requirements: sampleRequirements,
    });

    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThan(0);
    }
  });

  it("should ensure referential integrity (all question_ids exist)", () => {
    const validQIds = new Set(sampleQuestions.map((q) => q.id));
    const schedule = buildSchedule({
      daysAvailable: 5,
      questions: sampleQuestions,
      requirements: sampleRequirements,
    });

    for (const day of schedule.days) {
      for (const qid of day.question_ids) {
        expect(validQIds.has(qid)).toBe(true);
      }
    }
  });

  it("should schedule harder (difficulty 3) and must-have questions earlier", () => {
    const schedule = buildSchedule({
      daysAvailable: 5,
      questions: sampleQuestions,
      requirements: sampleRequirements,
    });

    // Day 1 should include difficulty 3 / must-have questions (q1 or q2)
    const day1QIds = schedule.days[0].question_ids;
    expect(day1QIds.some((id) => id === "q1" || id === "q2")).toBe(true);
  });

  it("should handle edge case of 1 day schedule", () => {
    const schedule = buildSchedule({
      daysAvailable: 1,
      questions: sampleQuestions,
      requirements: sampleRequirements,
    });

    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].question_ids.length).toBe(sampleQuestions.length);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
  });
});
