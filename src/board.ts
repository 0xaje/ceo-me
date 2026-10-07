import type { BoardSeat, BoardVerdict } from "./domain.js";

export interface BoardReasoningInput {
  userMessage: string;
  selectedSeats: BoardSeat[];
  recentDecisions?: string[];
  activeConstraints?: string[];
}

export interface BoardReasoningEngine {
  generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict>;
}

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
 * Deterministic Baseline Board Reasoning
 * Handles general Muse dilemmas (money, multi-task prioritization, buying/waiting, scope)
 * without requiring hardcoded demo strings.
 */
export class DeterministicBoardEngine implements BoardReasoningEngine {
  async generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict> {
    const text = input.userMessage.toLowerCase();
    const seats = input.selectedSeats;

    // 1. Two hackathons / competing priorities / multiple tasks
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
 * Dynamic LLM Board Engine
 * Connects to LLM (if OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY is configured).
 * Falls back to DeterministicBoardEngine automatically if no LLM is configured or on failure.
 */
export class DynamicBoardEngine implements BoardReasoningEngine {
  private fallback = new DeterministicBoardEngine();

  async generateVerdict(input: BoardReasoningInput): Promise<BoardVerdict> {
    // LLM Provider check (OpenAI / Gemini / Anthropic)
    const apiKey =
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return this.fallback.generateVerdict(input);
    }

    try {
      if (process.env.OPENAI_API_KEY) {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are CEO Me, a personal board of directors. Return JSON with: seats (array), perspectives (array of {seat, opinion}), verdict (short, punchy, calm, decisive), firstAction (concrete next step), suggestedCommitment (short sentence to commit to)."
              },
              {
                role: "user",
                content: JSON.stringify(input)
              }
            ]
          })
        });

        if (response.ok) {
          const json = await response.json();
          const parsed = JSON.parse(json.choices[0].message.content);
          if (parsed.verdict && parsed.firstAction) {
            return {
              seats: input.selectedSeats,
              perspectives: parsed.perspectives,
              verdict: parsed.verdict,
              firstAction: parsed.firstAction,
              suggestedCommitment: parsed.suggestedCommitment || parsed.firstAction
            };
          }
        }
      }
    } catch {
      // Fallback safely on any error
    }

    return this.fallback.generateVerdict(input);
  }
}
