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
/**
 * Vague filler phrases that indicate low-quality generic corporate/consultant AI speak.
 * These are strictly forbidden in Board verdicts, actions, and commitments.
 */
export const FORBIDDEN_FILLER_PHRASES: string[] = [
  "mutually acceptable",
  "mutually beneficial",
  "consider your options",
  "it is advisable",
  "ensure your needs are met",
  "prioritize your well-being",
  "find a balance",
  "weigh the pros and cons",
  "find a solution",
  "work toward",
  "try to",
  "be prepared",
  "focus on finding",
  "balance between",
  "schedule a meeting to explore"
];

/**
 * Concrete action verbs required in commitments
 */
const ACTION_VERBS = /\b(send|write|ship|build|call|cancel|sign|pay|deploy|finish|draft|cut|reject|accept|schedule|block|wire|publish|submit|deliver|decide|decline|review|kill|create|record|implement|negotiate)\b/i;

function countSentences(text: string): number {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches) {
    return text.trim() ? 1 : 0;
  }
  return matches.length;
}

/**
 * Check if text contains forbidden filler phrases
 */
export function containsForbiddenFiller(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_FILLER_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Detect blatant contradictions between verdict and first action
 * e.g. verdict says "decline" / "reject", but firstAction says "accept" / "take the offer"
 */
export function hasDirectContradiction(verdict: string, firstAction: string): boolean {
  const v = verdict.toLowerCase();
  const a = firstAction.toLowerCase();

  const verdictRejects = /\b(decline|reject|walk away|pass on|say no|drop)\b/.test(v);
  const actionAccepts = /\b(accept|take the|sign the|agree to)\b/.test(a) && !/\b(only if|unless|with revised|revised terms)\b/.test(a);

  if (verdictRejects && actionAccepts) {
    return true;
  }

  const verdictAccepts = /\b(accept|take the offer|say yes)\b/.test(v) && !/\b(decline|reject)\b/.test(v);
  const actionRejects = /\b(decline|reject|walk away|say no)\b/.test(a);

  if (verdictAccepts && actionRejects) {
    return true;
  }

  return false;
}

/**
 * Validate LLM Board Output against canonical rules & quality standards:
 * - verdict <= 2 sentences, no forbidden filler
 * - firstAction <= 2 sentences, no forbidden filler
 * - suggestedCommitment <= 1 sentence, has concrete action verb, no forbidden filler
 * - no direct contradiction between verdict and firstAction
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

  const verdict = obj.verdict.trim();
  const firstAction = obj.firstAction.trim();
  const suggestedCommitment =
    typeof obj.suggestedCommitment === "string" && obj.suggestedCommitment.trim()
      ? obj.suggestedCommitment.trim()
      : firstAction;

  // Length constraints
  if (countSentences(verdict) > 2) return null;
  if (countSentences(firstAction) > 2) return null;
  if (countSentences(suggestedCommitment) > 1) return null;

  // Filler phrase rejection
  if (containsForbiddenFiller(verdict)) return null;
  if (containsForbiddenFiller(firstAction)) return null;
  if (containsForbiddenFiller(suggestedCommitment)) return null;

  // Commitment must have a concrete action verb
  if (!ACTION_VERBS.test(suggestedCommitment)) {
    return null;
  }

  // Contradiction detection
  if (hasDirectContradiction(verdict, firstAction)) {
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
        VALID_BOARD_SEATS.has(p.seat.toLowerCase() as BoardSeat) &&
        allowedSet.has(p.seat.toLowerCase() as BoardSeat) &&
        typeof p.opinion === "string" &&
        p.opinion.trim() &&
        !containsForbiddenFiller(p.opinion)
      ) {
        perspectives.push({ seat: p.seat.toLowerCase() as BoardSeat, opinion: p.opinion.trim() });
      }
    }
  }

  return {
    seats: allowedSeats,
    perspectives: perspectives && perspectives.length > 0 ? perspectives : undefined,
    verdict,
    firstAction,
    suggestedCommitment
  };
}

/**
 * Deterministic Baseline Board Reasoning
 */
/**
 * Deterministic Baseline Board Reasoning Engine
 * Separates specific/high-confidence rules from general fallback.
 */
export class DeterministicBoardEngine implements BoardReasoningEngine {
  /**
   * High-confidence deterministic rule detection.
   * Returns a specific BoardVerdict immediately if a known pattern matches confidently,
   * or null if the dilemma is unfamiliar and should be considered by the LLM.
   */
  tryGenerateSpecificVerdict(input: BoardReasoningInput): BoardVerdict | null {
    const text = input.userMessage.toLowerCase();
    const seats = input.selectedSeats;

    // 1. Competing priorities / multiple tasks / hackathons
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
        verdict: "Take the client only if weekend work is premium-priced and capped.",
        firstAction: "Send revised terms with fixed weekend hours and a separate weekend rate.",
        suggestedCommitment: "Send revised terms with capped weekend scope tonight"
      };
    }

    // 3. Limited money / resource allocation tradeoff (e.g. conference vs runway, course vs debt, marketing vs operating cash)
    if (
      /runway|conference|ticket|afford both|cannot afford both|can't afford both|either .* or .* runway|course vs|marketing spend vs/.test(text) ||
      ((/money|cash|fund|budget/.test(text)) && (/runway|conference|course|travel|marketing/.test(text)) && (/either|choose|both|afford/.test(text)))
    ) {
      return {
        seats,
        perspectives: [
          { seat: "cfo", opinion: "Runway is oxygen and downside protection. Speculative networking tickets evaporate if you run out of cash." },
          { seat: "operator", opinion: "A month of runway gives you uninterrupted execution time. A conference only delivers value if you have an active deal on the table." },
          { seat: "future_you", opinion: "Opportunity cost is real: you cannot leverage career networking if your core project dies from zero runway." }
        ],
        verdict: "Keep the month of runway unless the conference gives you a specific high-value opportunity you can name today.",
        firstAction: "Write down the exact person, deal, or lead the conference unlocks; if none, protect the runway.",
        suggestedCommitment: "Decide today whether the conference has one concrete opportunity worth sacrificing runway"
      };
    }

    // 4. Buying laptop / equipment / spending vs waiting
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

    // 5. Family / personal commitment vs unfinished project
    if (/family|wife|husband|kids|dinner|stop working|promised/.test(text)) {
      return {
        seats,
        perspectives: [
          { seat: "future_you", opinion: "Breaking personal promises destroys credibility with the people who matter most." },
          { seat: "operator", opinion: "Stop working now and schedule tomorrow's first sprint block before you close the lid." }
        ],
        verdict: "Keep the promise to your family and stop now.",
        firstAction: "Write tomorrow's opening task and close your laptop immediately.",
        suggestedCommitment: "Close laptop and log tomorrow's sprint block"
      };
    }

    // 6. Polish / creative vs shipping / operator
    if (/polish|perfection|clean up|design vs ship|creative vs operator|good enough/.test(text)) {
      return {
        seats,
        perspectives: [
          { seat: "creative", opinion: "Craft creates taste, but unreleased craft has zero market signal." },
          { seat: "operator", opinion: "Ship the current functional build now. Polish v2 once users touch it." }
        ],
        verdict: "Ship the functional build now. Polish in the next release.",
        firstAction: "Cut the non-critical visual tweaks and deploy the current stable version.",
        suggestedCommitment: "Deploy current build without extra polish"
      };
    }

    // 7. Scope expansion / feature bloat
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

    return null;
  }

  /**
   * General fallback for unfamiliar dilemmas where no specific rule matched.
   * Sharp and tradeoff-focused without generic consultant filler.
   */
  generateGeneralFallback(input: BoardReasoningInput): BoardVerdict {
    const seats = input.selectedSeats;
    return {
      seats,
      perspectives: [
        { seat: "operator", opinion: "Overthinking is delay dressed as planning. Find the single irreversible next step." },
        { seat: "future_you", opinion: "Clarity comes from shipping concrete decisions, not endless deliberation." }
      ],
      verdict: "Choose the option that preserves maximum future optionality and execution velocity.",
      firstAction: "Define the single non-negotiable outcome you need, then execute the first step immediately.",
      suggestedCommitment: "Execute the critical path action before moving to secondary tasks"
    };
  }

  async generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict> {
    const specific = this.tryGenerateSpecificVerdict(input);
    if (specific) {
      return specific;
    }
    return this.generateGeneralFallback(input);
  }
}

/**
 * Dynamic Board Engine supporting Deterministic Fast Path, Ollama single-shot, and General Fallback.
 */
export class DynamicBoardEngine implements BoardReasoningEngine {
  private fallback = new DeterministicBoardEngine();

  constructor(
    private readonly provider: StructuredReasoningProvider | null = resolveConfiguredProvider()
  ) {}

  async generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict> {
    // 1. High-confidence deterministic fast path: return immediately without calling LLM
    const fastVerdict = this.fallback.tryGenerateSpecificVerdict(input);
    if (fastVerdict) {
      console.log("[BOARD] deterministic fast path");
      return fastVerdict;
    }

    // 2. If no provider is available, use general deterministic fallback
    if (!this.provider) {
      console.log("[BOARD] deterministic fallback");
      return this.fallback.generateGeneralFallback(input);
    }

    // 3. Unfamiliar dilemma: attempt single-shot Ollama generation
    const systemPrompt =
      "You are CEO Me, a sharp, decisive personal board of directors. You do NOT sound like a corporate consultant, therapist, or life coach.\n" +
      "Think strictly in real tradeoffs:\n" +
      "- What is gained vs what is sacrificed?\n" +
      "- What boundary, price, or condition resolves the tension?\n" +
      "- What single observable action must happen right now?\n\n" +
      "STYLE RULES:\n" +
      "1. Be concise, intelligent, decisive, and slightly witty.\n" +
      "2. NEVER use generic filler: 'mutually acceptable solution', 'consider your options', 'prioritize well-being', 'find a balance', 'it is advisable'.\n" +
      "3. The verdict must make ONE clear call. No contradictory recommendations.\n" +
      "4. The firstAction must directly execute the verdict (e.g. if verdict says negotiate terms, firstAction must draft/send those terms).\n" +
      "5. The suggestedCommitment must be exactly ONE measurable sentence containing an active verb (e.g. 'Send...', 'Ship...', 'Write...', 'Decline...').\n\n" +
      "Return ONLY a JSON object:\n" +
      "{\n" +
      "  \"perspectives\": [\n" +
      "    {\"seat\": \"<seat_name>\", \"opinion\": \"<one punchy sentence from this seat's angle>\"}\n" +
      "  ],\n" +
      "  \"verdict\": \"<1-2 decisive sentences resolving the tradeoff>\",\n" +
      "  \"firstAction\": \"<1-2 concrete action sentences implementing the verdict>\",\n" +
      "  \"suggestedCommitment\": \"<single actionable commitment sentence with concrete verb>\"\n" +
      "}";

    const userPrompt =
      `Dilemma: "${input.userMessage}"\n` +
      `Active Board Seats to include: ${input.selectedSeats.join(", ")}.\n` +
      `Evaluate the tradeoff and provide your ruling.`;

    const startTime = Date.now();
    console.log(`[BOARD] ${this.provider.providerName} attempt starting`);

    const structured = await this.provider.generateStructured<BoardVerdict>(
      systemPrompt,
      userPrompt,
      (val) => validateBoardOutput(val, input.selectedSeats)
    );

    const elapsed = Date.now() - startTime;

    if (structured) {
      console.log(`[BOARD] ${this.provider.providerName} valid in ${elapsed}ms`);
      return structured;
    }

    console.log(`[BOARD] ${this.provider.providerName} invalid in ${elapsed}ms -> fallback`);
    console.log("[BOARD] fallback");
    return this.fallback.generateGeneralFallback(input);
  }
}
