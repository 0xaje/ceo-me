import type { ConversationState, UserIntent } from "./domain.js";
import { parseNaturalDeadline } from "./deadline.js";
import {
  resolveConfiguredProvider,
  type StructuredReasoningProvider
} from "./llm/ollama.js";

export interface IntentContext {
  conversationState: ConversationState;
  hasActiveDecision: boolean;
  hasActiveCommitment: boolean;
  activeCommitmentText?: string;
  suggestedCommitmentText?: string;
}

export interface ClassifiedIntent {
  intent: UserIntent;
  confidence: number;
  extractedDeadline?: string;
  extractedText?: string;
  blocker?: string;
  commitmentModification?: string;
}

export interface IntentClassifier {
  classify(userMessage: string, context: IntentContext): Promise<ClassifiedIntent>;
}

export const ALLOWED_INTENTS: Set<UserIntent> = new Set([
  "NEW_DECISION",
  "ASK_EXPLANATION",
  "ACCEPT_COMMITMENT",
  "REJECT_COMMITMENT",
  "MODIFY_COMMITMENT",
  "SET_DEADLINE",
  "CHANGE_DEADLINE",
  "KEEP_DEADLINE",
  "RECONVENE_BOARD",
  "REPORT_DONE",
  "REPORT_BLOCKED",
  "REPORT_ABANDONED",
  "ASK_STATUS",
  "SMALL_TALK",
  "UNKNOWN"
]);

/**
 * Validate LLM raw output against structured intent schema
 */
export function validateIntentOutput(val: unknown): ClassifiedIntent | null {
  if (!val || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;

  if (typeof obj.intent !== "string" || !ALLOWED_INTENTS.has(obj.intent as UserIntent)) {
    return null;
  }

  const confidence =
    typeof obj.confidence === "number" && obj.confidence >= 0 && obj.confidence <= 1
      ? obj.confidence
      : 0.85;

  let extractedDeadline: string | undefined;
  if (typeof obj.deadlineText === "string" && obj.deadlineText.trim()) {
    const parsed = parseNaturalDeadline(obj.deadlineText.trim());
    if (parsed.success && parsed.iso) {
      extractedDeadline = parsed.iso;
    }
  }

  return {
    intent: obj.intent as UserIntent,
    confidence,
    extractedDeadline,
    blocker: typeof obj.blocker === "string" ? obj.blocker.trim() : undefined,
    commitmentModification:
      typeof obj.commitmentModification === "string"
        ? obj.commitmentModification.trim()
        : undefined,
    extractedText:
      typeof obj.explanationQuestion === "string"
        ? obj.explanationQuestion.trim()
        : typeof obj.newDecisionText === "string"
        ? obj.newDecisionText.trim()
        : undefined
  };
}

/**
 * Layer 1: Deterministic Fast Rule Classifier
 * Returns confidence >= 0.9 for explicit triggers to skip unnecessary LLM latency.
 */
export function classifyDeterministicIntent(
  userMessage: string,
  context: IntentContext
): ClassifiedIntent {
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // 1. Explicit explanations / questions:
  if (
    /^(why\b|what exactly\b|who voted\b|can you explain\b|tell me more\b)/.test(lower) ||
    lower.includes("why did the board") ||
    lower.includes("what am i supposed to") ||
    lower.includes("what did the board") ||
    lower.includes("what exactly did i agree to") ||
    lower.includes("what did i commit to") ||
    lower.includes("what was my task") ||
    lower.includes("explain why") ||
    lower.includes("why future you") ||
    lower.includes("why is future you") ||
    lower.includes("why is operator") ||
    lower.includes("why is cfo") ||
    lower.includes("why is creative")
  ) {
    return { intent: "ASK_EXPLANATION", confidence: 0.95, extractedText: text };
  }

  // 2. Status queries:
  if (
    lower.includes("how am i doing") ||
    lower.includes("how am i doing?") ||
    lower.includes("my status") ||
    lower.includes("how is my progress") ||
    lower.includes("track record") ||
    lower === "status"
  ) {
    return { intent: "ASK_STATUS", confidence: 0.95 };
  }

  // 3. Keep deadline / same deadline
  if (
    lower === "1" ||
    lower === "keep it" ||
    lower === "keep the deadline" ||
    lower === "same deadline" ||
    lower === "keep same deadline" ||
    lower.includes("keep the same deadline") ||
    lower.includes("keep it")
  ) {
    return { intent: "KEEP_DEADLINE", confidence: 0.95 };
  }

  // 4. Reconvene the Board
  if (
    lower === "3" ||
    lower.includes("reconvene") ||
    lower.includes("ask the board again") ||
    lower.includes("let the board reconsider") ||
    lower.includes("reconsider")
  ) {
    return { intent: "RECONVENE_BOARD", confidence: 0.95 };
  }

  // 5. Explicit commitment task modifications
  if (
    lower.includes("change the task") ||
    lower.includes("change task") ||
    lower.includes("modify task") ||
    lower.includes("change commitment")
  ) {
    let newTask = text;
    if (lower.includes("to ")) {
      newTask = text.slice(lower.indexOf("to ") + 3).trim();
    }
    return {
      intent: "MODIFY_COMMITMENT",
      confidence: 0.9,
      commitmentModification: newTask,
      extractedText: newTask
    };
  }

  // 6. Explicit outcomes (DONE, BLOCKED, ABANDONED)
  if (
    lower === "done" ||
    lower === "done now" ||
    lower === "finished" ||
    lower === "shipped" ||
    lower === "i did it" ||
    lower === "i have completed"
  ) {
    return { intent: "REPORT_DONE", confidence: 0.95 };
  }

  if (
    lower === "i gave up" ||
    lower === "i abandoned it" ||
    lower === "abandoned" ||
    lower === "scratch that" ||
    lower === "drop it"
  ) {
    return { intent: "REPORT_ABANDONED", confidence: 0.95, extractedText: text };
  }

  if (
    lower.includes("mostly") ||
    lower.includes("basically finished") ||
    lower.includes("haven't tested") ||
    lower.includes("havent tested") ||
    lower.startsWith("i'm blocked") ||
    lower.startsWith("blocked") ||
    lower.includes("photon is blocking me") ||
    lower.includes("is not responding")
  ) {
    let blocker = text;
    if (lower.includes("because")) {
      blocker = text.slice(lower.indexOf("because") + 7).trim();
    } else if (lower.includes("but")) {
      blocker = text.slice(lower.indexOf("but") + 3).trim();
    }
    return { intent: "REPORT_BLOCKED", confidence: 0.95, blocker, extractedText: text };
  }

  // 7. AWAITING_COMMITMENT_CONFIRMATION or DECISION_DISCUSSION
  if (
    context.conversationState === "AWAITING_COMMITMENT_CONFIRMATION" ||
    context.conversationState === "DECISION_DISCUSSION"
  ) {
    if (
      lower === "no" ||
      lower === "nah" ||
      lower === "i don't want to commit" ||
      lower === "dont want to commit" ||
      lower === "not that"
    ) {
      return { intent: "REJECT_COMMITMENT", confidence: 0.95 };
    }

    const acceptTriggers = [
      "yes",
      "yeah",
      "hold me to it",
      "deal",
      "let's do it",
      "lets do it",
      "lock it in",
      "sure",
      "okay",
      "sounds good",
      "let's go"
    ];

    const hasExactAccept = acceptTriggers.some(
      (tr) => lower === tr || lower.startsWith(tr + ",") || lower.startsWith(tr + ".")
    );

    if (hasExactAccept) {
      const parsedDeadline = parseNaturalDeadline(text);
      if (parsedDeadline.success && parsedDeadline.iso) {
        return {
          intent: "ACCEPT_COMMITMENT",
          confidence: 0.95,
          extractedDeadline: parsedDeadline.iso
        };
      }
      return { intent: "ACCEPT_COMMITMENT", confidence: 0.95 };
    }
  }

  // 8. AWAITING_DEADLINE: explicit deadlines & personal constraints
  if (context.conversationState === "AWAITING_DEADLINE") {
    // Check if user is expressing a constraint/hesitation rather than a deadline
    if (
      lower.includes("promise") ||
      lower.includes("family") ||
      lower.includes("stop working") ||
      lower.includes("not sure") ||
      lower.includes("don't know") ||
      lower.includes("dont know")
    ) {
      return {
        intent: "NEW_DECISION",
        confidence: 0.5,
        extractedText: text
      };
    }

    const parsed = parseNaturalDeadline(text);
    if (parsed.success && parsed.iso) {
      return {
        intent: "SET_DEADLINE",
        confidence: 0.95,
        extractedDeadline: parsed.iso
      };
    }
    if (parsed.ambiguous) {
      return {
        intent: "SET_DEADLINE",
        confidence: 0.85,
        extractedDeadline: undefined,
        extractedText: parsed.clarificationPrompt
      };
    }
  }

  // 9. Rescheduling in COMMITMENT_ACTIVE / BLOCKED / FOLLOW_UP_DUE: explicit change
  if (
    context.conversationState === "COMMITMENT_ACTIVE" ||
    context.conversationState === "BLOCKED" ||
    context.conversationState === "FOLLOW_UP_DUE"
  ) {
    if (
      lower === "2" ||
      lower === "move it" ||
      lower.includes("move it") ||
      lower.includes("make it") ||
      lower.includes("another hour") ||
      lower.includes("give me another") ||
      lower.includes("give me ") ||
      lower.includes("more time")
    ) {
      const parsed = parseNaturalDeadline(text);
      if (parsed.success && parsed.iso) {
        return {
          intent: "CHANGE_DEADLINE",
          confidence: 0.95,
          extractedDeadline: parsed.iso,
          extractedText: text
        };
      }
    }
  }

  // 10. Small talk
  if (/^(hello|hi|hey|good morning|ping)$/.test(lower)) {
    return { intent: "SMALL_TALK", confidence: 0.95 };
  }

  // Ambiguous input candidate
  return { intent: "NEW_DECISION", confidence: 0.5, extractedText: text };
}

/**
 * Two-Layer Semantic Intent Router
 * Precedence:
 * 1. Layer 1 fast deterministic rules (confidence >= 0.9) -> [ROUTER] deterministic
 * 2. Provider (Ollama or OpenAI) -> [ROUTER] ollama / [ROUTER] openai
 * 3. Fallback deterministic -> [ROUTER] fallback
 */
export class TwoLayerIntentRouter implements IntentClassifier {
  constructor(private readonly provider: StructuredReasoningProvider | null = resolveConfiguredProvider()) {}

  async classify(userMessage: string, context: IntentContext): Promise<ClassifiedIntent> {
    const layer1 = classifyDeterministicIntent(userMessage, context);

    // Fast path: high confidence deterministic commands avoid unnecessary model latency
    if (layer1.confidence >= 0.9) {
      console.log(`[ROUTER] deterministic (${layer1.intent})`);
      return layer1;
    }

    // Call Structured Provider (Ollama / OpenAI)
    if (this.provider) {
      const systemPrompt =
        "You are the intent classification layer for CEO Me, an executive agent. " +
        "Analyze the user message and conversation context. Output JSON with:\n" +
        "- intent: (one of: NEW_DECISION, ASK_EXPLANATION, ACCEPT_COMMITMENT, REJECT_COMMITMENT, MODIFY_COMMITMENT, SET_DEADLINE, CHANGE_DEADLINE, KEEP_DEADLINE, RECONVENE_BOARD, REPORT_DONE, REPORT_BLOCKED, REPORT_ABANDONED, ASK_STATUS, SMALL_TALK, UNKNOWN)\n" +
        "- confidence: number between 0.0 and 1.0\n" +
        "- deadlineText: string (optional, if user mentioned a time or relative duration)\n" +
        "- blocker: string (optional, if user mentioned an obstacle)\n" +
        "- commitmentModification: string (optional, if user asked to change task)\n" +
        "- explanationQuestion: string (optional, if user asked why or what)\n" +
        "- newDecisionText: string (optional, if this is a new dilemma)";

      const modelInput = {
        userMessage,
        conversationState: context.conversationState,
        hasActiveDecision: context.hasActiveDecision,
        hasActiveCommitment: context.hasActiveCommitment,
        activeCommitmentText: context.activeCommitmentText,
        pendingCommitmentDraft: context.suggestedCommitmentText
      };

      const structured = await this.provider.generateStructured<ClassifiedIntent>(
        systemPrompt,
        modelInput,
        validateIntentOutput
      );

      if (structured) {
        console.log(`[ROUTER] ${this.provider.providerName} (${structured.intent})`);
        return structured;
      }

      console.log(`[ROUTER] fallback (${layer1.intent})`);
    } else {
      console.log(`[ROUTER] deterministic (${layer1.intent})`);
    }

    return layer1;
  }
}
