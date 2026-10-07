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
  blocker?: string;
  commitmentModification?: string;
}

export interface IntentClassifier {
  classify(userMessage: string, context: IntentContext): Promise<ClassifiedIntent>;
}

/**
 * Layer 1: Deterministic Fast Rule Classifier
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
    lower.includes("why is ")
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

  // 3. Keep deadline / same deadline (in BLOCKED state or general)
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

  // 4. Reconvene the Board (in BLOCKED state or discussion)
  if (
    lower === "3" ||
    lower.includes("reconvene") ||
    lower.includes("ask the board again") ||
    lower.includes("let the board reconsider") ||
    lower.includes("reconsider")
  ) {
    return { intent: "RECONVENE_BOARD", confidence: 0.95 };
  }

  // 5. Change task / modify commitment
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

  // 6. Outcomes (DONE, BLOCKED, ABANDONED)
  if (
    lower.includes("mostly") ||
    lower.includes("blocked") ||
    lower.includes("stuck") ||
    lower.includes("not yet") ||
    lower.includes("isn't responding") ||
    lower.includes("is not responding") ||
    lower.includes("failing") ||
    lower.includes("has an issue") ||
    lower.includes("keeps dropping") ||
    lower.includes("dropping the")
  ) {
    let blocker = text;
    if (lower.includes("because")) {
      blocker = text.slice(lower.indexOf("because") + 7).trim();
    } else if (lower.includes("but")) {
      blocker = text.slice(lower.indexOf("but") + 3).trim();
    }
    return { intent: "REPORT_BLOCKED", confidence: 0.9, blocker, extractedText: text };
  }

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

  // 7. In AWAITING_COMMITMENT_CONFIRMATION or DECISION_DISCUSSION
  if (
    context.conversationState === "AWAITING_COMMITMENT_CONFIRMATION" ||
    context.conversationState === "DECISION_DISCUSSION"
  ) {
    if (
      lower === "no" ||
      lower === "nah" ||
      lower.includes("don't want to commit") ||
      lower.includes("dont want to commit") ||
      lower.includes("not that") ||
      lower.includes("not what i want")
    ) {
      if (lower.includes("not that") || lower.includes("different")) {
        return { intent: "MODIFY_COMMITMENT", confidence: 0.9, extractedText: text };
      }
      return { intent: "REJECT_COMMITMENT", confidence: 0.9 };
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
      "let's go",
      "lets go",
      "i commit"
    ];

    const hasAcceptTrigger = acceptTriggers.some(
      (tr) => lower === tr || lower.startsWith(tr + " ") || lower.startsWith(tr + ",")
    );

    if (hasAcceptTrigger) {
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

  // 8. In AWAITING_DEADLINE
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

  // 9. In COMMITMENT_ACTIVE / BLOCKED / FOLLOW_UP_DUE: change or move deadline
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
      lower.includes("more time") ||
      lower.includes("change the deadline") ||
      lower.includes("reschedule") ||
      lower.includes("give me until") ||
      lower.includes("give me another") ||
      lower.includes("give me ")
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

  // 10. Small talk
  if (/^(hello|hi|hey|good morning|ping)$/.test(lower)) {
    return { intent: "SMALL_TALK", confidence: 0.9 };
  }

  // 11. Default: new decision / discussion
  return { intent: "NEW_DECISION", confidence: 0.8, extractedText: text };
}

/**
 * Two-Layer Semantic Intent Router
 * Layer 1: Fast deterministic rule matching
 * Layer 2: LLM Structured Classifier (if OPENAI_API_KEY / GEMINI_API_KEY is available)
 */
export class TwoLayerIntentRouter implements IntentClassifier {
  async classify(userMessage: string, context: IntentContext): Promise<ClassifiedIntent> {
    const layer1 = classifyDeterministicIntent(userMessage, context);

    // If layer 1 has high confidence or matches an unambiguous intent, return immediately
    if (
      layer1.confidence >= 0.9 ||
      layer1.intent === "REPORT_DONE" ||
      layer1.intent === "REPORT_BLOCKED" ||
      layer1.intent === "ACCEPT_COMMITMENT" ||
      layer1.intent === "REJECT_COMMITMENT" ||
      layer1.intent === "KEEP_DEADLINE" ||
      layer1.intent === "RECONVENE_BOARD"
    ) {
      return layer1;
    }

    // Layer 2: LLM classification if API key is present
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Classify user intent in CEO Me conversation. Output JSON with: intent, confidence, deadlineText (optional), blocker (optional), commitmentModification (optional), explanationQuestion (optional), newDecisionText (optional). Allowed intents: NEW_DECISION, ASK_EXPLANATION, ACCEPT_COMMITMENT, REJECT_COMMITMENT, MODIFY_COMMITMENT, SET_DEADLINE, CHANGE_DEADLINE, KEEP_DEADLINE, RECONVENE_BOARD, REPORT_DONE, REPORT_BLOCKED, REPORT_ABANDONED, ASK_STATUS, SMALL_TALK, UNKNOWN."
              },
              {
                role: "user",
                content: JSON.stringify({ message: userMessage, context })
              }
            ]
          })
        });

        if (response.ok) {
          const json = await response.json();
          const parsed = JSON.parse(json.choices[0].message.content);
          if (parsed.intent) {
            let extractedDeadline: string | undefined;
            if (parsed.deadlineText) {
              const res = parseNaturalDeadline(parsed.deadlineText);
              if (res.success) extractedDeadline = res.iso;
            }

            return {
              intent: parsed.intent as UserIntent,
              confidence: parsed.confidence || 0.9,
              extractedDeadline,
              blocker: parsed.blocker,
              commitmentModification: parsed.commitmentModification,
              extractedText: parsed.newDecisionText || userMessage
            };
          }
        }
      } catch {
        // Fall back safely to layer 1
      }
    }

    return layer1;
  }
}
