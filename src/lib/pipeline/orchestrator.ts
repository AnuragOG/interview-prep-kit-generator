import {
  PipelineProgressEvent,
  PrepKit,
  Question,
  QuestionCategory,
  Requirement,
} from "@/types/kit";
import { crawlCompanySite, searchPublicInterviewIntel } from "../crawler/crawler";
import { extractJDRequirements } from "./jd-extractor";
import { synthesizeCompanyResearch } from "./company-researcher";
import { generateCategoryQuestions } from "./question-generator";
import { generateFlashcards } from "./flashcard-generator";
import { runCoveragePasses } from "./gap-generator";
import { buildSchedule } from "./schedule-allocator";
import { validatePrepKit } from "./validator";

export interface GenerateKitOptions {
  jd: string;
  companyUrl: string;
  days: number;
  onProgress?: (event: PipelineProgressEvent) => void;
}

export async function runKitGenerationPipeline(
  options: GenerateKitOptions
): Promise<PrepKit> {
  const { jd, companyUrl, days, onProgress } = options;

  const emitProgress = (
    step: PipelineProgressEvent["step"],
    message: string,
    percentage: number,
    data?: any
  ) => {
    if (onProgress) {
      onProgress({ step, message, percentage, data });
    }
  };

  emitProgress("init", "Initializing interview preparation pipeline...", 5);

  // ----------------------------------------------------
  // Step 1: Extract Requirements from Job Description
  // ----------------------------------------------------
  emitProgress("extract_jd", "Analyzing job description & extracting core requirements...", 15);
  const extractedJD = await extractJDRequirements(jd, companyUrl);

  const roleInfo = {
    title: extractedJD.title,
    seniority: extractedJD.seniority,
    responsibilities: extractedJD.responsibilities,
    requirements: extractedJD.requirements,
  };

  // ----------------------------------------------------
  // Step 2: Intelligent Company Crawler & Link Ranker
  // ----------------------------------------------------
  emitProgress("crawl_company", `Crawling ${companyUrl} & discovering hiring pathways...`, 30);
  const crawlResult = await crawlCompanySite(companyUrl, 3);

  // ----------------------------------------------------
  // Step 3: Public Discussion Intel Search
  // ----------------------------------------------------
  emitProgress("gather_intel", "Searching public interview discussions and candidate feedback...", 45);
  const publicIntel = await searchPublicInterviewIntel(
    extractedJD.company,
    extractedJD.title
  );

  // ----------------------------------------------------
  // Step 4: Company Research Synthesis
  // ----------------------------------------------------
  emitProgress("gather_intel", "Synthesizing company brief and hiring process intelligence...", 55);
  const companyBrief = await synthesizeCompanyResearch({
    companyName: extractedJD.company,
    companyUrl,
    crawledPages: crawlResult.pagesUsed,
    publicIntel,
    hiringPageFound: crawlResult.hiringPageFound,
  });

  // ----------------------------------------------------
  // Step 5: Category-Specific Question Generation
  // ----------------------------------------------------
  emitProgress("generate_questions", "Generating targeted questions across technical & behavioral categories...", 65);

  const context = {
    companyName: extractedJD.company,
    role: roleInfo,
    companyBrief,
  };

  // Group requirements by kind
  const techReqs = roleInfo.requirements.filter((r) => r.kind === "technical");
  const behavReqs = roleInfo.requirements.filter((r) => r.kind === "behavioural");
  const domainReqs = roleInfo.requirements.filter((r) => r.kind === "domain");

  const initialQuestions: Question[] = [];
  let currentQId = 1;

  // 5a. Technical Questions
  const techQ = await generateCategoryQuestions("technical", techReqs, context, currentQId);
  initialQuestions.push(...techQ);
  currentQId += techQ.length;

  // 5b. System Design Questions (for technical/mid/senior roles)
  if (techReqs.length > 0 || roleInfo.seniority.toLowerCase().includes("senior") || roleInfo.seniority.toLowerCase().includes("lead")) {
    const sysQ = await generateCategoryQuestions("system-design", techReqs.slice(0, 3), context, currentQId);
    initialQuestions.push(...sysQ);
    currentQId += sysQ.length;
  }

  // 5c. Behavioural Questions
  const behavQ = await generateCategoryQuestions("behavioural", behavReqs.length > 0 ? behavReqs : roleInfo.requirements.slice(0, 2), context, currentQId);
  initialQuestions.push(...behavQ);
  currentQId += behavQ.length;

  // 5d. Company Fit Questions
  const fitQ = await generateCategoryQuestions("company-fit", domainReqs.length > 0 ? domainReqs : roleInfo.requirements.slice(0, 2), context, currentQId);
  initialQuestions.push(...fitQ);
  currentQId += fitQ.length;

  // ----------------------------------------------------
  // Step 6: Flashcard Generation
  // ----------------------------------------------------
  emitProgress("generate_flashcards", "Building active recall flashcard deck...", 78);
  const flashcards = await generateFlashcards(roleInfo, extractedJD.company);

  // ----------------------------------------------------
  // Step 7: Deterministic Coverage Check & Second Pass Gap Loop
  // ----------------------------------------------------
  emitProgress("check_coverage", "Executing deterministic coverage audit against must-have requirements...", 85);
  const multiPassResult = await runCoveragePasses(
    initialQuestions,
    roleInfo,
    companyBrief,
    extractedJD.company,
    3 // Max passes
  );

  const finalQuestions = multiPassResult.questions;

  // ----------------------------------------------------
  // Step 8: Deterministic Arithmetic Schedule Allocator
  // ----------------------------------------------------
  emitProgress("build_schedule", `Allocating material across ${days} days...`, 92);
  const schedule = buildSchedule({
    daysAvailable: days,
    questions: finalQuestions,
    requirements: roleInfo.requirements,
    roleTitle: roleInfo.title,
    companyName: extractedJD.company,
  });

  // ----------------------------------------------------
  // Step 9: Assemble Final Kit (Appendix A)
  // ----------------------------------------------------
  const pagesUsed = crawlResult.pagesUsed.map((p) => p.url);
  if (pagesUsed.length === 0) {
    pagesUsed.push(companyUrl);
  }

  const kit: PrepKit = {
    source: {
      company: extractedJD.company,
      company_url: companyUrl,
      role: roleInfo.title,
      location: extractedJD.location,
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed,
    },
    company_brief: companyBrief,
    role: roleInfo,
    questions: finalQuestions,
    flashcards,
    schedule,
    coverage: {
      uncovered_requirement_ids: multiPassResult.uncovered_requirement_ids,
      passes: multiPassResult.passes,
    },
  };

  // ----------------------------------------------------
  // Step 10: Strict Appendix A Validation
  // ----------------------------------------------------
  const validation = validatePrepKit(kit);
  if (!validation.isValid) {
    console.warn("[Orchestrator] Validation warnings:", validation.errors);
  }

  emitProgress("completed", "Interview preparation kit generated successfully!", 100, kit);

  return kit;
}
