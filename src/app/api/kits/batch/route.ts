import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/auth";
import { localStore } from "@/lib/db/mongodb";
import { runKitGenerationPipeline } from "@/lib/pipeline/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cases } = await req.json();

    if (!Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json(
        { error: "Payload must be an array of test cases: [{ jd, company_url, days }]" },
        { status: 400 }
      );
    }

    const createdKits: Array<{ id: string; company: string; role: string; status: string; error?: string }> = [];

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      try {
        if (!c.jd) continue;

        const kit = await runKitGenerationPipeline({
          jd: c.jd,
          companyUrl: c.company_url || "https://example.com",
          days: typeof c.days === "number" ? c.days : 5,
        });

        const kitId = "kit_" + Math.random().toString(36).substring(2, 10);
        await localStore.saveKit({
          id: kitId,
          userId: auth.userId,
          kit,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        createdKits.push({
          id: kitId,
          company: kit.source.company,
          role: kit.role.title,
          status: "success",
        });
      } catch (err: any) {
        createdKits.push({
          id: `item-${i + 1}`,
          company: c.company_url || "Unknown",
          role: "Failed",
          status: "failed",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results: createdKits,
      total: cases.length,
      succeeded: createdKits.filter((k) => k.status === "success").length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Batch generation failed" }, { status: 500 });
  }
}
