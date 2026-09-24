import fs from "fs";
import path from "path";
import { BatchCaseInput, BatchCaseResult, BatchOutput } from "../src/types/kit";
import { runKitGenerationPipeline } from "../src/lib/pipeline/orchestrator";
import { validatePrepKit } from "../src/lib/pipeline/validator";

// Parse CLI arguments: --input <file> --output <file>
function parseArgs(): { inputPath: string; outputPath: string } {
  const args = process.argv.slice(2);
  let inputPath = "";
  let outputPath = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      inputPath = args[i + 1];
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  if (!inputPath || !outputPath) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  return {
    inputPath: path.resolve(process.cwd(), inputPath),
    outputPath: path.resolve(process.cwd(), outputPath),
  };
}

async function runEvaluation() {
  const { inputPath, outputPath } = parseArgs();

  console.log(`\n======================================================`);
  console.log(` Trao Assessment Pipeline - Batch Evaluation Entry Point`);
  console.log(` Input File:  ${inputPath}`);
  console.log(` Output File: ${outputPath}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file does not exist at ${inputPath}`);
    process.exit(1);
  }

  let rawData: string;
  try {
    rawData = fs.readFileSync(inputPath, "utf-8");
  } catch (err: any) {
    console.error(`Failed to read input file: ${err.message}`);
    process.exit(1);
  }

  let cases: BatchCaseInput[];
  try {
    cases = JSON.parse(rawData);
    if (!Array.isArray(cases)) {
      throw new Error("Input file root must be a JSON array of cases.");
    }
  } catch (err: any) {
    console.error(`Invalid JSON in input file: ${err.message}`);
    process.exit(1);
  }

  console.log(`Loaded ${cases.length} case(s) for evaluation.\n`);

  const results: BatchCaseResult[] = [];

  for (let idx = 0; idx < cases.length; idx++) {
    const c = cases[idx];
    const caseId = c.id || `case-${idx + 1}`;
    console.log(`------------------------------------------------------`);
    console.log(`[${idx + 1}/${cases.length}] Processing Case: ${caseId}`);
    console.log(`Company URL: ${c.company_url} | Days Requested: ${c.days}`);
    console.log(`JD Length: ${c.jd?.length || 0} characters`);

    try {
      if (!c.jd || typeof c.jd !== "string") {
        throw new Error("Missing or invalid job description text (jd).");
      }

      const kit = await runKitGenerationPipeline({
        jd: c.jd,
        companyUrl: c.company_url || "https://example.com",
        days: typeof c.days === "number" ? c.days : 5,
        onProgress: (ev) => {
          console.log(`  -> [${ev.percentage}%] ${ev.message}`);
        },
      });

      const validation = validatePrepKit(kit);
      if (!validation.isValid) {
        console.warn(`  [Warning] Schema warnings for ${caseId}:`, validation.errors);
      }

      results.push({
        id: caseId,
        status: "ok",
        kit,
        error: null,
      });

      console.log(`✓ Case ${caseId} completed successfully.\n`);
    } catch (err: any) {
      console.error(`✗ Case ${caseId} failed: ${err.message}\n`);
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: err.code || "PIPELINE_ERROR",
          message: err.message || "An unexpected error occurred during generation.",
        },
      });
    }
  }

  const batchOutput: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  try {
    // Ensure parent directory of output exists
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(batchOutput, null, 2), "utf-8");
    console.log(`======================================================`);
    console.log(`Batch evaluation complete!`);
    console.log(`Results successfully written to: ${outputPath}`);
    console.log(`Total Cases: ${cases.length} | Succeeded: ${results.filter((r) => r.status === "ok").length} | Failed: ${results.filter((r) => r.status === "failed").length}`);
    console.log(`======================================================\n`);
  } catch (err: any) {
    console.error(`Failed to write output file: ${err.message}`);
    process.exit(1);
  }
}

runEvaluation().catch((err) => {
  console.error("Fatal error during evaluation run:", err);
  process.exit(1);
});
