import type { BoardSeat, BoardVerdict } from "./domain.js";
import {
  resolveConfiguredProvider,
  type StructuredReasoningProvider
} from "./llm/ollama.js";

export interface BoardReasoningInput {
  userMessage: string;
  selectedSeats: BoardSeat[];
  recentDecisions?: string[];
  activeConstraints?: string[];
}

export interface BoardReasoningEngine {
  generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict>;
}

export const VALID_BOARD_SEATS: Set<BoardSeat> = new Set([
  "future_you",
  "cfo",
  "operator",
  "creative",
  "chaos_intern"
]);

export function selectBoard(input: string): BoardSeat[] {
  const text = input.toLowerCase();

  if (/money|price|buy|cost|revenue|salary|budget|spend|invest|fund|client|freelance|rate/.test(text)) {
    return ["cfo", "operator", "future_you"];
  }

  if (/post|content|design|creative|brand|video|launch|marketing|copy|presentation/.test(text)) {
    return ["creative", "operator", "future_you"];
  }

  if (/crazy|wild|radical|throwaway|disrupt|blow it up|weird/.test(text)) {
    return ["chaos_intern", "operator", "future_you"];
  }

  return ["operator", "future_you"];
}

/**
 * Validate LLM Board Output against canonical rules
 */
export function validateBoardOutput(
  val: unknown,
  allowedSeats: BoardSeat[]
): BoardVerdict | null {
  if (!val || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;

  if (
    typeof obj.verdict !== "string" ||
    !obj.verdict.trim() ||
    typeof obj.firstAction !== "string" ||
    !obj.firstAction.trim()
  ) {
    return null;
  }

  const allowedSet = new Set(allowedSeats);
  let perspectives: { seat: BoardSeat; opinion: string }[] | undefined;

  if (Array.isArray(obj.perspectives)) {
    perspectives = [];
    for (const p of obj.perspectives) {
      if (
        p &&
        typeof p === "object" &&
        typeof p.seat === "string" &&
        VALID_BOARD_SEATS.has(p.seat as BoardSeat) &&
        allowedSet.has(p.seat as BoardSeat) &&
        typeof p.opinion === "string"
      ) {
        perspectives.push({ seat: p.seat as BoardSeat, opinion: p.opinion.trim() });
      }
    }
  }

  return {
    seats: allowedSeats,
    perspectives: perspectives && perspectives.length > 0 ? perspectives : undefined,
    verdict: obj.verdict.trim(),
    firstAction: obj.firstAction.trim(),
    suggestedCommitment:
      typeof obj.suggestedCommitment === "string" && obj.suggestedCommitment.trim()
        ? obj.suggestedCommitment.trim()
        : obj.firstAction.trim()
  };
}

/**
 * Deterministic Baseline Board Reasoning
 */
export class DeterministicBoardEngine implements BoardReasoningEngine {
  async generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict> {
    const text = input.userMessage.toLowerCase();
    const seats = input.selectedSeats;

    // 1. Competing priorities / multiple tasks
    if (/two|which one|prioriti|hackathon|project a or project b|choose between/.test(text)) {
      return {
        seats,
        perspectives: [
          { seat: "operator", opinion: "Kill optionality immediately. Pick the one with the clearer finish line." },
          { seat: "future_you", opinion: "Finishing one project build creates leverage. Splitting focus yields two half-baked submissions." }
        ],
        verdict: "Kill split attention. Pick the single highest-probability win and commit 100% to it.",
        firstAction: "Drop the secondary project entirely for today and outline the critical path for the winner.",
        suggestedCommitment: "Commit exclusively to the primary project today"
      };
    }

    // 2. Freelance / client paying more vs weekend work / burnout tradeoff
    if (/client|freelance|weekend|work life|pay more|rate/.test(text)) {
      return {
        seats,
        perspectives: [
          { seat: "cfo", opinion: "Higher revenue is good, but pricing must reflect the surrendered weekend flexibility." },
          { seat: "operator", opinion: "Weekend client work is an operational debt trap unless scope is strictly capped." },
          { seat: "future_you", opinion: "Burnout wipes out multiple weeks of productivity. Protect energy unless cash runway requires it." }
        ],
        verdict: "Do not surrender weekends for marginal pay. Either 2x the rate with capped scope, or decline.",
        firstAction: "Reply with the premium weekend rate and explicit delivery boundaries.",
        suggestedCommitment: "Send revised terms with capped weekend scope"
      };
    }

    // 3. Buying laptop / equipment / spending vs waiting
    if (/buy|laptop|gear|purchase|wait|upgrade/.test(text)) {
      return {
        seats,
        perspectives: [
          { seat: "cfo", opinion: "Hardware is an investment only if current equipment is causing measurable bottleneck." },
          { seat: "operator", opinion: "If your tool is slowing daily builds, replace it now. If it's a vanity upgrade, wait." },
          { seat: "future_you", opinion: "Speed of thought and execution pays dividends every single day." }
        ],
        verdict: "If current tool friction slows daily shipping, buy the tool. Otherwise, hold cash until revenue hits.",
        firstAction: "Audit if equipment friction caused a delay today. If yes, pull the trigger.",
        suggestedCommitment: "Upgrade hardware only if blocking current workflow"
      };
    }

    // 4. Scope expansion / feature bloat
    if (/dashboard|calendar integration|email integration|more features|add features|expand|settings/.test(text)) {
      return {
        seats,
        perspectives: [
          { seat: "operator", opinion: "Every feature you add before proving the core loop is liability." },
          { seat: "future_you", opinion: "Shipping one complete end-to-end loop beats ten unfinished settings panels." }
        ],
        verdict: "Stop expanding scope. Ship the complete decision → commitment → follow-up loop first.",
        firstAction: "Get one complete decision → commitment → follow-up flow working.",
        suggestedCommitment: "Finish the real iMessage commitment flow"
      };
    }

    // 5. Default General Muse Verdict
    return {
      seats,
      perspectives: [
        { seat: "operator", opinion: "Overthinking is delay dressed as planning. Find the smallest irreversible next step." },
        { seat: "future_you", opinion: "Clarity follows action, not debate." }
      ],
      verdict: "Reduce this to one decision and act on the smallest irreversible next step.",
      firstAction: "Write the single outcome you want, then take one concrete action toward it.",
      suggestedCommitment: "Execute the single smallest next step today"
    };
  }
}

/**
 * Dynamic Board Engine supporting Ollama & Cloud LLM with automatic fallback
 */
export class DynamicBoardEngine implements BoardReasoningEngine {
  private fallback = new DeterministicBoardEngine();

  constructor(
    private readonly provider: StructuredReasoningProvider | null = resolveConfiguredProvider()
  ) {}

  async generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict> {
    if (!this.provider) {
      console.log("[BOARD] deterministic");
      return this.fallback.generateVerdict(input);
    }

    const systemPrompt =
      "You are CEO Me, a personal board of directors. Your voice is calm, decisive, intelligent, concise, and slightly witty. " +
      "Never use corporate jargon, therapy speak, or generic advice. Lower cognitive load. Resolve internal disagreements.\n\n" +
      "Return ONLY a valid JSON object matching:\n" +
      "{\n" +
      "  \"perspectives\": [\n" +
      "    {\"seat\": \"<seat_name>\", \"opinion\": \"<one sharp sentence>\"}\n" +
      "  ],\n" +
      "  \"verdict\": \"<one decisive sentence ruling on the dilemma>\",\n" +
      "  \"firstAction\": \"<one concrete immediate action>\",\n" +
      "  \"suggestedCommitment\": \"<single sentence commitment>\"\n" +
      "}\n\n" +
      "RULES:\n" +
      "1. Only include the exact seats requested by the user.\n" +
      "2. Keep each opinion strictly one short sentence.\n" +
      "3. Close all JSON quotes and braces properly.";

    const userPrompt =
      `User dilemma: "${input.userMessage}"\n` +
      `Generate perspectives ONLY for these seats: ${input.selectedSeats.join(", ")}.`;

    const structured = await this.provider.generateStructured<BoardVerdict>(
      systemPrompt,
      userPrompt,
      (val) => validateBoardOutput(val, input.selectedSeats)
    );

    if (structured) {
      console.log(`[BOARD] ${this.provider.providerName}`);
      return structured;
    }

    console.log("[BOARD] fallback");
    return this.fallback.generateVerdict(input);
  }
}
