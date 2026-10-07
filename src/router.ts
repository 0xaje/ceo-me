import type { ConversationState, UserIntent } from "./domain.js";
import { parseNaturalDeadline } from "./deadline.js";

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
}

/**
 * Natural language intent router
 * Evaluates user message in the context of current conversation state.
 */
export function classifyIntent(
  userMessage: string,
  context: IntentContext
): ClassifiedIntent {
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // 1. Explicit explanations / questions:
  // "why did the board decide that?", "why did the board choose that?", "why is future you on the board?", "what exactly am I supposed to finish?"
  if (
    /^(why\b|what exactly\b|who voted\b|can you explain\b|tell me more\b)/.test(lower) ||
    lower.includes("why did the board") ||
    lower.includes("what am i supposed to") ||
    lower.includes("what did the board") ||
    lower.includes("why is ")
  ) {
    return { intent: "ASK_EXPLANATION", confidence: 0.95, extractedText: text };
  }

  // 2. Status queries:
  // "how am I doing?", "what's my status?", "show my record", "how's my progress"
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

  // 3. Outcomes (DONE, BLOCKED, ABANDONED, etc.)
  // Check for partial/blocked:
  if (
    lower.includes("mostly") ||
    lower.includes("blocked") ||
    lower.includes("stuck") ||
    lower.includes("not yet") ||
    lower.includes("isn't responding") ||
    lower.includes("is not responding") ||
    lower.includes("failing") ||
    lower.includes("has an issue")
  ) {
    return { intent: "REPORT_BLOCKED", confidence: 0.9, extractedText: text };
  }

  // Check for abandonment:
  if (
    lower.includes("gave up") ||
    lower.includes("abandoned") ||
    lower.includes("drop it") ||
    lower.includes("changed my mind") ||
    lower.includes("scratch that") ||
    lower === "abandoned"
  ) {
    return { intent: "REPORT_ABANDONED", confidence: 0.9, extractedText: text };
  }

  // Check for completion:
  if (
    lower === "done" ||
    lower === "done now" ||
    lower === "finished" ||
    lower === "shipped" ||
    lower === "i did it" ||
    lower.includes("finished it") ||
    lower.includes("shipped it") ||
    lower.includes("i have completed") ||
    lower.includes("completed it")
  ) {
    return { intent: "REPORT_DONE", confidence: 0.95 };
  }

  // 4. In AWAITING_COMMITMENT_CONFIRMATION or DECISION_DISCUSSION
  if (
    context.conversationState === "AWAITING_COMMITMENT_CONFIRMATION" ||
    context.conversationState === "DECISION_DISCUSSION"
  ) {
    // Rejections / Reconsideration:
    // "no", "not that", "I don't want to commit", "can we reconsider?", "nah", "change the task"
    if (
      lower === "no" ||
      lower === "nah" ||
      lower.includes("don't want to commit") ||
      lower.includes("dont want to commit") ||
      lower.includes("not that") ||
      lower.includes("reconsider") ||
      lower.includes("change the task") ||
      lower.includes("not what i want")
    ) {
      if (lower.includes("change") || lower.includes("not that") || lower.includes("different")) {
        return { intent: "MODIFY_COMMITMENT", confidence: 0.9, extractedText: text };
      }
      return { intent: "REJECT_COMMITMENT", confidence: 0.9 };
    }

    // Acceptance (with or without deadline embedded)
    // "yes", "yeah", "hold me to it", "deal", "let's do it", "lock it in", "yes, by 8 tonight", "yeah hold me to it"
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
      "let's go",
      "lets go",
      "i commit"
    ];

    const hasAcceptTrigger = acceptTriggers.some(
      (tr) => lower === tr || lower.startsWith(tr + " ") || lower.startsWith(tr + ",")
    );

    if (hasAcceptTrigger) {
      // Check if deadline is included: e.g. "yes, by 8 tonight", "yeah hold me to it, give me 30 mins"
      const parsedDeadline = parseNaturalDeadline(text);
      if (parsedDeadline.success && parsedDeadline.iso) {
        return {
          intent: "ACCEPT_COMMITMENT",
          confidence: 0.95,
          extractedDeadline: parsedDeadline.iso
        };
      }
      return { intent: "ACCEPT_COMMITMENT", confidence: 0.9 };
    }
  }

  // 5. In AWAITING_DEADLINE
  if (context.conversationState === "AWAITING_DEADLINE") {
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
        confidence: 0.7,
        extractedDeadline: undefined,
        extractedText: parsed.clarificationPrompt
      };
    }
  }

  // 6. In COMMITMENT_ACTIVE: change deadline
  if (context.conversationState === "COMMITMENT_ACTIVE") {
    // "make it 9 instead", "give me another hour", "actually make it 9pm", "reschedule for tomorrow"
    if (
      lower.includes("make it") ||
      lower.includes("another hour") ||
      lower.includes("more time") ||
      lower.includes("change the deadline") ||
      lower.includes("reschedule") ||
      lower.includes("give me until") ||
      lower.includes("give me another")
    ) {
      const parsed = parseNaturalDeadline(text);
      return {
        intent: "CHANGE_DEADLINE",
        confidence: 0.9,
        extractedDeadline: parsed.iso,
        extractedText: text
      };
    }
  }

  // 7. Small talk or generic phrases
  if (/^(hello|hi|hey|good morning|ping)$/.test(lower)) {
    return { intent: "SMALL_TALK", confidence: 0.9 };
  }

  // 8. If nothing matched and user sent a sentence describing a dilemma, decision or problem
  return { intent: "NEW_DECISION", confidence: 0.8, extractedText: text };
}
