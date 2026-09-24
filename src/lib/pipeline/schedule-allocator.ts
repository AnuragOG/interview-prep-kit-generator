import { Question, Requirement, Schedule, ScheduleDay } from "@/types/kit";

export interface ScheduleBuildInput {
  daysAvailable: number;
  questions: Question[];
  requirements: Requirement[];
  roleTitle?: string;
  companyName?: string;
}

/**
 * Deterministic Arithmetic Schedule Allocator (Pure Code)
 * Distributes questions across exactly `days_available` days.
 * Ensures harder/must-have questions land earlier, and minutes are strictly integers.
 */
export function buildSchedule(input: ScheduleBuildInput): Schedule {
  const rawDays = Number(input.daysAvailable);
  const daysAvailable = Math.max(1, Math.min(60, Math.floor(isNaN(rawDays) ? 5 : rawDays)));
  const { questions, requirements } = input;

  if (questions.length === 0) {
    // Edge case: No questions generated
    const emptyDays: ScheduleDay[] = Array.from({ length: daysAvailable }, (_, i) => ({
      day: i + 1,
      focus: i === 0 ? "Initial Role Alignment" : `Interview Preparation Day ${i + 1}`,
      question_ids: [],
      minutes: 30,
    }));
    return { days_available: daysAvailable, days: emptyDays };
  }

  // Create a map of requirement priority
  const mustHaveReqIds = new Set(
    requirements.filter((r) => r.priority === "must").map((r) => r.id)
  );

  // Score each question for scheduling order:
  // Higher score = should be scheduled earlier in the timeline
  const scoredQuestions = questions.map((q) => {
    let score = 0;

    // Must-have requirements get highest precedence
    const coversMustHave = q.requirement_ids.some((id) => mustHaveReqIds.has(id));
    if (coversMustHave) score += 100;

    // Difficulty score (3 = Hardest -> Earlier, 1 = Screen -> Later)
    score += q.difficulty * 25;

    // Category weighting
    if (q.category === "system-design") score += 40;
    else if (q.category === "technical") score += 30;
    else if (q.category === "behavioural") score += 15;
    else if (q.category === "company-fit") score += 5;

    return { question: q, score };
  });

  // Sort descending by score (Harder + Must-Have earlier)
  scoredQuestions.sort((a, b) => b.score - a.score);

  const sortedQList = scoredQuestions.map((sq) => sq.question);

  // Initialize day bins
  const dayBins: Array<{
    day: number;
    focus: string;
    questionIds: string[];
    rawMinutes: number;
  }> = [];

  for (let d = 1; d <= daysAvailable; d++) {
    let defaultFocus = "Technical Core & Foundations";
    if (daysAvailable === 1) {
      defaultFocus = "Comprehensive High-Yield Intensive";
    } else {
      const progress = d / daysAvailable;
      if (progress <= 0.35) {
        defaultFocus = "Core Technical Architecture & Must-Haves";
      } else if (progress <= 0.7) {
        defaultFocus = "Deep Dive Scenarios & Practical Problem-Solving";
      } else if (progress < 1.0) {
        defaultFocus = "Behavioural STAR Stories & Leadership";
      } else {
        defaultFocus = "Company Alignment, Culture Fit & Final Review";
      }
    }

    dayBins.push({
      day: d,
      focus: defaultFocus,
      questionIds: [],
      rawMinutes: 15, // Baseline setup/review time
    });
  }

  if (daysAvailable === 1) {
    // 1-Day schedule: All questions included
    dayBins[0].questionIds = sortedQList.map((q) => q.id);
  } else {
    // Distribute questions across available days
    // Separate by category theme
    const hardTech = sortedQList.filter(
      (q) => (q.category === "system-design" || q.category === "technical") && q.difficulty >= 2
    );
    const midTech = sortedQList.filter(
      (q) => q.category === "technical" && q.difficulty < 2
    );
    const behavioural = sortedQList.filter((q) => q.category === "behavioural");
    const companyFit = sortedQList.filter((q) => q.category === "company-fit");

    // Distribute Hard Technical & System Design to early days (first half)
    const earlyDaysCount = Math.max(1, Math.ceil(daysAvailable * 0.5));
    hardTech.forEach((q, idx) => {
      const dayIdx = idx % earlyDaysCount;
      dayBins[dayIdx].questionIds.push(q.id);
    });

    // Distribute midTech
    const midDaysCount = Math.max(1, Math.min(daysAvailable, Math.ceil(daysAvailable * 0.75)));
    midTech.forEach((q, idx) => {
      const dayIdx = (idx % midDaysCount);
      dayBins[dayIdx].questionIds.push(q.id);
    });

    // Distribute behavioural towards later half
    const behavStartDay = Math.max(0, Math.floor(daysAvailable * 0.4));
    const behavDaysSpan = Math.max(1, daysAvailable - behavStartDay);
    behavioural.forEach((q, idx) => {
      const dayIdx = behavStartDay + (idx % behavDaysSpan);
      dayBins[dayIdx].questionIds.push(q.id);
    });

    // Distribute company fit to last days
    const lastDayIdx = daysAvailable - 1;
    const secondLastDayIdx = Math.max(0, daysAvailable - 2);
    companyFit.forEach((q, idx) => {
      const dayIdx = idx % 2 === 0 ? lastDayIdx : secondLastDayIdx;
      dayBins[dayIdx].questionIds.push(q.id);
    });

    // Guarantee that no day is left completely empty when questions exist
    // If daysAvailable > questions.length, populate later review days with high-priority recap questions
    for (let i = 0; i < daysAvailable; i++) {
      if (dayBins[i].questionIds.length === 0) {
        // Reuse top must-have or core questions for spaced review
        const fallbackQ = sortedQList[i % sortedQList.length];
        dayBins[i].questionIds.push(fallbackQ.id);
        dayBins[i].focus = `Spaced Repetition Review & Deep-Dive (${fallbackQ.category})`;
      }
    }
  }

  // Calculate integer minutes for each day based on question difficulty
  const qMap = new Map<string, Question>(questions.map((q) => [q.id, q]));

  const finalDays: ScheduleDay[] = dayBins.map((bin) => {
    // Unique question IDs per day
    const uniqueIds = Array.from(new Set(bin.questionIds));

    let minutes = 15; // Setup time
    for (const qId of uniqueIds) {
      const q = qMap.get(qId);
      if (q) {
        if (q.difficulty === 3) minutes += 25;
        else if (q.difficulty === 2) minutes += 15;
        else minutes += 10;
      } else {
        minutes += 10;
      }
    }

    // Ensure minutes is a clean integer
    const integerMinutes = Math.max(20, Math.round(minutes));

    return {
      day: bin.day,
      focus: bin.focus,
      question_ids: uniqueIds,
      minutes: integerMinutes,
    };
  });

  return {
    days_available: daysAvailable,
    days: finalDays,
  };
}
