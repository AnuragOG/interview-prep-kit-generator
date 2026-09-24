import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

// Token Bucket & Queue for Rate Limit Handling
class RateLimiter {
  private lastRequestTime = 0;
  private minIntervalMs = 800; // Free tier throttle

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new RateLimiter();

export class LLMClient {
  private geminiClient: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;
  private provider: "gemini" | "openai" | "groq" | "mock" = "gemini";
  private geminiModel: string = "gemini-1.5-flash";
  private openaiModel: string = "gpt-4o-mini";

  constructor() {
    this.init();
  }

  private init() {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();

    if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.provider = "gemini";
      this.geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    } else if (openaiKey && openaiKey.startsWith("sk-") && !openaiKey.includes("your_openai")) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
      this.provider = "openai";
      this.openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
    } else if (groqKey) {
      this.openaiClient = new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      this.provider = "groq";
      this.openaiModel = "llama-3.1-8b-instant";
    } else {
      this.provider = "mock";
    }
  }

  // Sanitize untrusted input to mitigate prompt injection
  static wrapUntrusted(label: string, content: string): string {
    const safeContent = content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<untrusted_input label="${label}">\n${safeContent}\n</untrusted_input>`;
  }

  // Parse JSON safely from LLM output (stripping ```json blocks if present)
  static parseJSON<T>(rawText: string): T {
    let clean = rawText.trim();
    // Remove markdown code fences
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      return JSON.parse(clean) as T;
    } catch (err: any) {
      // Find JSON object bounds
      const firstBrace = clean.indexOf("{");
      const firstBracket = clean.indexOf("[");
      const lastBrace = clean.lastIndexOf("}");
      const lastBracket = clean.lastIndexOf("]");

      const start =
        firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
          ? firstBrace
          : firstBracket;
      const end =
        lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)
          ? lastBrace
          : lastBracket;

      if (start !== -1 && end !== -1 && end > start) {
        const extracted = clean.substring(start, end + 1);
        return JSON.parse(extracted) as T;
      }

      throw new Error(`Failed to parse JSON from LLM response: ${err.message}. Response preview: ${clean.slice(0, 200)}`);
    }
  }

  // Gemini Call
  private async callGemini<T>(messages: LLMMessage[], options: LLMOptions): Promise<T> {
    if (!this.geminiClient) throw new Error("Gemini client not initialized");

    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const userMessages = messages.filter((m) => m.role !== "system");

    const model = this.geminiClient.getGenerativeModel({
      model: this.geminiModel,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.max_tokens ?? 4000,
        responseMimeType: options.response_format?.type === "json_object" ? "application/json" : "text/plain",
      },
      systemInstruction: systemMsg ? { role: "system", parts: [{ text: systemMsg }] } : undefined,
    });

    const promptText = userMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const result = await model.generateContent(promptText);
    const responseText = result.response.text();

    if (options.response_format?.type === "json_object") {
      return LLMClient.parseJSON<T>(responseText);
    }
    return responseText as unknown as T;
  }

  // OpenAI / Groq Call
  private async callOpenAI<T>(messages: LLMMessage[], options: LLMOptions): Promise<T> {
    if (!this.openaiClient) throw new Error("OpenAI client not initialized");

    const response = await this.openaiClient.chat.completions.create({
      model: this.openaiModel,
      messages: messages as any,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 2500,
      response_format: options.response_format,
    });

    const content = response.choices[0]?.message?.content || "";
    if (options.response_format?.type === "json_object") {
      return LLMClient.parseJSON<T>(content);
    }
    return content as unknown as T;
  }

  // Call LLM with retries, exponential backoff, and rate limiting
  async chatCompletion<T = string>(
    messages: LLMMessage[],
    options: LLMOptions = {},
    retries = 3
  ): Promise<T> {
    // Re-verify in case env vars were set dynamically
    this.init();

    if (this.provider === "mock") {
      throw new Error(
        "No LLM API Key found. Please set GEMINI_API_KEY (or OPENAI_API_KEY) in your .env file."
      );
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await rateLimiter.acquire();

        if (this.provider === "gemini") {
          return await this.callGemini<T>(messages, options);
        } else {
          return await this.callOpenAI<T>(messages, options);
        }
      } catch (err: any) {
        const isRateLimit =
          err?.status === 429 ||
          err?.message?.includes("rate_limit") ||
          err?.message?.includes("429") ||
          err?.message?.includes("RESOURCE_EXHAUSTED") ||
          err?.message?.includes("slow down");
        const isServerErr = err?.status >= 500 || err?.message?.includes("503");

        if ((isRateLimit || isServerErr) && attempt < retries) {
          const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
          console.warn(
            `[LLMClient] Attempt ${attempt + 1} encountered ${err.message}. Backing off for ${Math.round(delay)}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw new Error(`LLM Error (${this.provider}): ${err.message}`);
      }
    }

    throw new Error(`LLM failed after ${retries} retries.`);
  }
}

export const llmClient = new LLMClient();
