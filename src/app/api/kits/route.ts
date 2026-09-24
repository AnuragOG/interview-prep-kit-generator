import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/auth";
import { localStore } from "@/lib/db/mongodb";
import { runKitGenerationPipeline } from "@/lib/pipeline/orchestrator";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const kits = await localStore.findKitsByUserId(auth.userId);
    return NextResponse.json({ kits });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please log in to generate kits." }, { status: 401 });
    }

    const { jd, company_url, days, stream } = await req.json();

    if (!jd || typeof jd !== "string" || jd.trim().length === 0) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 }
      );
    }

    const sanitizedUrl = (company_url || "https://example.com").trim();
    const daysRequested = typeof days === "number" ? days : 5;

    // Check if client requested Server-Sent Events (SSE) streaming
    if (stream) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();

      // Launch async pipeline in background writing to SSE
      (async () => {
        try {
          const kit = await runKitGenerationPipeline({
            jd,
            companyUrl: sanitizedUrl,
            days: daysRequested,
            onProgress: async (ev) => {
              const payload = `data: ${JSON.stringify(ev)}\n\n`;
              await writer.write(encoder.encode(payload));
            },
          });

          // Save generated kit
          const kitId = "kit_" + Math.random().toString(36).substring(2, 10);
          const savedRecord = await localStore.saveKit({
            id: kitId,
            userId: auth.userId,
            kit,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          const finalPayload = `data: ${JSON.stringify({
            step: "completed",
            message: "Kit created successfully",
            percentage: 100,
            kitId: savedRecord.id,
            kit: savedRecord.kit,
          })}\n\n`;
          await writer.write(encoder.encode(finalPayload));
        } catch (pipelineErr: any) {
          const errPayload = `data: ${JSON.stringify({
            step: "failed",
            message: pipelineErr.message || "Failed to generate kit",
            percentage: 100,
            error: pipelineErr.message,
          })}\n\n`;
          await writer.write(encoder.encode(errPayload));
        } finally {
          await writer.close();
        }
      })();

      return new Response(responseStream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming standard response
    const kit = await runKitGenerationPipeline({
      jd,
      companyUrl: sanitizedUrl,
      days: daysRequested,
    });

    const kitId = "kit_" + Math.random().toString(36).substring(2, 10);
    const savedRecord = await localStore.saveKit({
      id: kitId,
      userId: auth.userId,
      kit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      kitId: savedRecord.id,
      kit: savedRecord.kit,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate interview kit." },
      { status: 500 }
    );
  }
}
