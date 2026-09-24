import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/auth";
import { localStore } from "@/lib/db/mongodb";
import { PrepKit, Question, QuestionCategory } from "@/types/kit";
import { generateCategoryQuestions } from "@/lib/pipeline/question-generator";
import { synthesizeCompanyResearch } from "@/lib/pipeline/company-researcher";
import { crawlCompanySite } from "@/lib/crawler/crawler";
import { generateFlashcards } from "@/lib/pipeline/flashcard-generator";
import { buildSchedule } from "@/lib/pipeline/schedule-allocator";
import { checkCoverage } from "@/lib/pipeline/coverage-checker";

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
      return NextResponse.json({ error: "Kit not found or access denied" }, { status: 404 });
    }

    const currentKit: PrepKit = record.kit;
    const body = await req.json();
    const { target, category } = body;

    let updatedKit: PrepKit = JSON.parse(JSON.stringify(currentKit));

    if (target === "company_brief") {
      // 1. Regenerate Company Brief
      const crawlRes = await crawlCompanySite(currentKit.source.company_url, 3);
      const newBrief = await synthesizeCompanyResearch({
        companyName: currentKit.source.company,
        companyUrl: currentKit.source.company_url,
        crawledPages: crawlRes.pagesUsed,
        publicIntel: [],
        hiringPageFound: crawlRes.hiringPageFound,
      });

      updatedKit.company_brief = newBrief;
    } else if (target === "category") {
      // 2. Regenerate a Specific Question Category (Preserving Edited and Pinned Questions!)
      const cat = category as QuestionCategory;
      if (!["technical", "behavioural", "system-design", "company-fit"].includes(cat)) {
        return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
      }

      // Separate existing questions in this category into Protected vs Regenerable
      const preservedOtherCategoryQuestions = currentKit.questions.filter(
        (q) => q.category !== cat
      );
      const categoryQuestions = currentKit.questions.filter((q) => q.category === cat);

      // User modified / created / pinned questions MUST SURVIVE
      const protectedCategoryQuestions = categoryQuestions.filter(
        (q) => q.origin === "edited" || q.origin === "manual" || q.pinned === true
      );

      // Determine requirements relevant to this category
      let categoryReqs = currentKit.role.requirements.filter((r) => {
        if (cat === "technical" || cat === "system-design") return r.kind === "technical";
        if (cat === "behavioural") return r.kind === "behavioural";
        return r.kind === "domain";
      });

      if (categoryReqs.length === 0) {
        categoryReqs = currentKit.role.requirements.slice(0, 3);
      }

      // Generate fresh questions
      const maxExistingIdNum = currentKit.questions.reduce((max, q) => {
        const num = parseInt(q.id.replace(/\D/g, ""), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);

      const freshQuestions = await generateCategoryQuestions(
        cat,
        categoryReqs,
        {
          companyName: currentKit.source.company,
          role: currentKit.role,
          companyBrief: currentKit.company_brief,
        },
        maxExistingIdNum + 1
      );

      // Merge: Protected user questions + Freshly generated questions
      const mergedQuestions = [
        ...preservedOtherCategoryQuestions,
        ...protectedCategoryQuestions,
        ...freshQuestions,
      ];

      updatedKit.questions = mergedQuestions;

      // Re-run deterministic coverage & update coverage stats
      const covReport = checkCoverage(currentKit.role.requirements, mergedQuestions);
      updatedKit.coverage = {
        uncovered_requirement_ids: covReport.uncovered_requirement_ids,
        passes: currentKit.coverage.passes + 1,
      };

      // Re-allocate schedule with updated questions
      updatedKit.schedule = buildSchedule({
        daysAvailable: currentKit.schedule.days_available,
        questions: mergedQuestions,
        requirements: currentKit.role.requirements,
      });
    } else if (target === "flashcards") {
      // 3. Regenerate Flashcards (Preserving user-edited/pinned cards)
      const protectedCards = currentKit.flashcards.filter(
        (f) => f.origin === "edited" || f.origin === "manual" || f.pinned === true
      );
      const newGenerated = await generateFlashcards(
        currentKit.role,
        currentKit.source.company
      );
      updatedKit.flashcards = [...protectedCards, ...newGenerated];
    } else if (target === "schedule") {
      // 4. Rebuild Schedule
      const requestedDays = body.days ? Number(body.days) : currentKit.schedule.days_available;
      updatedKit.schedule = buildSchedule({
        daysAvailable: requestedDays,
        questions: currentKit.questions,
        requirements: currentKit.role.requirements,
      });
    } else {
      return NextResponse.json({ error: `Unknown regeneration target: ${target}` }, { status: 400 });
    }

    // Persist updated kit
    await localStore.updateKit(params.id, updatedKit);

    return NextResponse.json({
      success: true,
      kit: updatedKit,
      message: `Section '${target}' regenerated successfully while preserving custom edits and pinned items.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Section regeneration failed" }, { status: 500 });
  }
}
