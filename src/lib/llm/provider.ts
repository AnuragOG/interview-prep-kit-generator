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
  private minIntervalMs = 800; // Throttle to stay safe within free tier limits

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
  private openai: OpenAI | null = null;
  private provider: "openai" | "gemini" | "groq" | "mock" = "openai";
  private modelName: string = "gpt-4o-mini";

  constructor() {
    this.init();
  }

  private init() {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();

    if (openaiKey && openaiKey !== "your_openai_api_key_here") {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.provider = "openai";
      this.modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    } else if (groqKey) {
      this.openai = new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      this.provider = "groq";
      this.modelName = "llama-3.1-8b-instant";
    } else if (geminiKey) {
      // Gemini's OpenAI-compatible endpoint
      this.openai = new OpenAI({
        apiKey: geminiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
      this.provider = "gemini";
      this.modelName = "gemini-1.5-flash";
    } else {
      // Fallback mock mode if no API key is set yet, so tests can run without crashing immediately
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
      // Try finding the first '{' or '[' and last '}' or ']'
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

  // Call LLM with retries, exponential backoff, and rate limiting
  async chatCompletion<T = string>(
    messages: LLMMessage[],
    options: LLMOptions = {},
    retries = 3
  ): Promise<T> {
    // Re-verify in case env vars were set after initial load
    if (!this.openai && process.env.OPENAI_API_KEY) {
      this.init();
    }

    if (this.provider === "mock" || !this.openai) {
      // If running without API key, throw informative error
      throw new Error(
        "OPENAI_API_KEY (or GEMINI_API_KEY / GROQ_API_KEY) is not configured in the environment. Please set it in .env"
      );
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await rateLimiter.acquire();

        const response = await this.openai.chat.completions.create({
          model: this.modelName,
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
      } catch (err: any) {
        const isRateLimit =
          err?.status === 429 ||
          err?.message?.includes("rate_limit") ||
          err?.message?.includes("Rate limit") ||
          err?.message?.includes("slow down");
        const isServerErr = err?.status >= 500;

        if ((isRateLimit || isServerErr) && attempt < retries) {
          // Exponential backoff with jitter: 2s, 4s, 8s + jitter
          const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
          console.warn(
            `[LLMClient] Attempt ${attempt + 1} encountered ${err.message}. Backing off for ${Math.round(delay)}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw new Error(`LLM Error (${this.provider}/${this.modelName}): ${err.message}`);
      }
    }

    throw new Error(`LLM failed after ${retries} retries.`);
  }
}

export const llmClient = new LLMClient();
