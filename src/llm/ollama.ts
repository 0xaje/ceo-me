/**
 * Structured LLM reasoning abstraction for CEO Me.
 * Provides a clean interface for local Ollama and cloud LLMs.
 */

export interface StructuredReasoningProvider {
  readonly providerName: string;
  generateStructured<T>(
    systemPrompt: string,
    input: unknown,
    validator: (value: unknown) => T | null
  ): Promise<T | null>;
}

export interface OllamaClientOptions {
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
}

/**
 * Local Ollama HTTP API provider
 * Uses local HTTP API (/api/chat) with JSON mode, AbortController timeout, and validation.
 */
export class OllamaReasoningProvider implements StructuredReasoningProvider {
  readonly providerName = "ollama";
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = (options.baseUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
    this.model = options.model;
    const envTimeout = process.env.OLLAMA_TIMEOUT_MS ? parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) : NaN;
    this.timeoutMs = options.timeoutMs ?? (!isNaN(envTimeout) ? envTimeout : 45000);
  }

  async generateStructured<T>(
    systemPrompt: string,
    input: unknown,
    validator: (value: unknown) => T | null
  ): Promise<T | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: typeof input === "string" ? input : JSON.stringify(input)
            }
          ],
          format: "json",
          stream: false,
          keep_alive: "60m",
          options: {
            temperature: 0.1,
            num_predict: 350
          }
        })
      });

      if (!response.ok) {
        console.warn(`[OLLAMA] HTTP ${response.status} from ${this.baseUrl}`);
        return null;
      }

      const raw = await response.json();
      const content = raw?.message?.content;
      if (!content || typeof content !== "string") {
        console.warn("[OLLAMA] Missing content in chat response");
        return null;
      }

      let parsed: unknown;
      try {
        const cleaned = content.replace(/```(?:json)?/gi, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        console.warn("[OLLAMA] Failed to parse JSON response:", (err as Error).message);
        console.warn("[OLLAMA] Raw content was:\n", content);
        return null;
      }

      const validated = validator(parsed);
      if (validated === null) {
        console.warn("[OLLAMA] Response failed schema validation:", JSON.stringify(parsed));
        return null;
      }

      return validated;
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        console.warn(`[OLLAMA] Request timed out after ${this.timeoutMs}ms`);
      } else {
        console.warn("[OLLAMA] Request failed:", (error as Error).message);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * OpenAI Cloud Provider (secondary fallback if configured)
 */
export class OpenAiReasoningProvider implements StructuredReasoningProvider {
  readonly providerName = "openai";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model = "gpt-4o-mini", timeoutMs = 12000) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async generateStructured<T>(
    systemPrompt: string,
    input: unknown,
    validator: (value: unknown) => T | null
  ): Promise<T | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: typeof input === "string" ? input : JSON.stringify(input)
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        console.warn(`[OPENAI] HTTP ${response.status}`);
        return null;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      return validator(parsed);
    } catch (err) {
      console.warn("[OPENAI] Call failed:", (err as Error).message);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Resolve the active StructuredReasoningProvider following documented precedence:
 * 1. Ollama if OLLAMA_MODEL is configured
 * 2. OpenAI if OPENAI_API_KEY is configured
 * 3. null (deterministic fallback)
 */
export function resolveConfiguredProvider(): StructuredReasoningProvider | null {
  const ollamaModel = process.env.OLLAMA_MODEL?.trim();
  if (ollamaModel) {
    const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
    return new OllamaReasoningProvider({
      model: ollamaModel,
      baseUrl
    });
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return new OpenAiReasoningProvider(openAiKey);
  }

  return null;
}
