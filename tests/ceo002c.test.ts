import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DynamicBoardEngine,
  validateBoardOutput
} from "../src/board.js";
import type { BoardVerdict } from "../src/domain.js";
import { formatDeadline, parseNaturalDeadline } from "../src/deadline.js";
import type { StructuredReasoningProvider } from "../src/llm/ollama.js";
import {
  TwoLayerIntentRouter,
  validateIntentOutput,
  type ClassifiedIntent
} from "../src/router.js";
import { CeoMeService } from "../src/service.js";
import { JsonFileStore } from "../src/store.js";

async function makeService(customProvider?: StructuredReasoningProvider) {
  const dir = await mkdtemp(join(tmpdir(), "ceo-me-ollama-test-"));
  const file = join(dir, "store.json");
  const store = new JsonFileStore(file);
  const boardEngine = new DynamicBoardEngine(customProvider || null);
  const router = new TwoLayerIntentRouter(customProvider || null);
  const service = new CeoMeService(store, boardEngine, router, customProvider || null);
  return { dir, file, store, service };
}

describe("CEO-002C Local Ollama Reasoning & Provider Adapter", () => {
  it("A. accepts valid structured classifier output from provider", async () => {
    const mockProvider: StructuredReasoningProvider = {
      providerName: "mock-ollama",
      async generateStructured<T>(_system: string, _input: unknown, validator: (v: unknown) => T | null): Promise<T | null> {
        return validator({
          intent: "MODIFY_COMMITMENT",
          confidence: 0.92,
          commitmentModification: "Finish only the scheduler",
          explanationQuestion: undefined
        });
      }
    };

    const router = new TwoLayerIntentRouter(mockProvider);
    // User sends ambiguous phrasing
    const classified = await router.classify("I think I'm making the wrong commitment.", {
      conversationState: "AWAITING_COMMITMENT_CONFIRMATION",
      hasActiveDecision: true,
      hasActiveCommitment: false
    });

    expect(classified.intent).toBe("MODIFY_COMMITMENT");
    expect(classified.confidence).toBe(0.92);
    expect(classified.commitmentModification).toBe("Finish only the scheduler");
  });

  it("B. malformed JSON / invalid intent causes deterministic fallback", async () => {
    // 1. Invalid intent
    const invalidVal = validateIntentOutput({
      intent: "SOME_RANDOM_INTENT",
      confidence: 0.9
    });
    expect(invalidVal).toBeNull();

    // 2. Malformed shape
    expect(validateIntentOutput(null)).toBeNull();
    expect(validateIntentOutput("not-json")).toBeNull();

    // 3. Provider returning null causes fallback in router
    const failingProvider: StructuredReasoningProvider = {
      providerName: "failing-ollama",
      async generateStructured() {
        return null;
      }
    };

    const router = new TwoLayerIntentRouter(failingProvider);
    const classified = await router.classify("I have another dilemma to think about", {
      conversationState: "IDLE",
      hasActiveDecision: false,
      hasActiveCommitment: false
    });

    // Falls back to deterministic Layer 1 classification safely
    expect(classified.intent).toBe("NEW_DECISION");
  });

  it("C. deadline text from model is safely verified through deterministic deadline parser", async () => {
    const validated = validateIntentOutput({
      intent: "SET_DEADLINE",
      confidence: 0.88,
      deadlineText: "Friday at 5pm"
    });

    expect(validated).not.toBeNull();
    expect(validated?.extractedDeadline).toBeDefined();
    // Proven to be valid ISO UTC string
    expect(new Date(validated!.extractedDeadline!).getTime()).not.toBeNaN();
  });

  it("D. dynamic Board output is validated and illegal board seats are filtered", async () => {
    const rawOutput = {
      perspectives: [
        { seat: "operator", opinion: "Ship it." },
        { seat: "fake_seat", opinion: "Hallucinated opinion." },
        { seat: "future_you", opinion: "Compound value." }
      ],
      verdict: "Decisive action required.",
      firstAction: "Write the script.",
      suggestedCommitment: "Ship script"
    };

    const validated = validateBoardOutput(rawOutput, ["operator", "future_you"]);
    expect(validated).not.toBeNull();
    expect(validated?.perspectives).toHaveLength(2);
    expect(validated?.perspectives?.map((p) => p.seat)).toEqual(["operator", "future_you"]);
    expect(validated?.perspectives?.some((p) => (p.seat as any) === "fake_seat")).toBe(false);
  });

  it("E. high-confidence deterministic commands bypass provider call", async () => {
    let providerCalled = false;
    const trackingProvider: StructuredReasoningProvider = {
      providerName: "tracking-ollama",
      async generateStructured() {
        providerCalled = true;
        return null;
      }
    };

    const router = new TwoLayerIntentRouter(trackingProvider);
    // Explicit DONE command
    const res = await router.classify("done now", {
      conversationState: "FOLLOW_UP_DUE",
      hasActiveDecision: true,
      hasActiveCommitment: true
    });

    expect(res.intent).toBe("REPORT_DONE");
    expect(providerCalled).toBe(false); // Bypassed model call!
  });

  it("F. dynamic contextual explanation grounded in stored context", async () => {
    const mockProvider: StructuredReasoningProvider = {
      providerName: "mock-ollama",
      async generateStructured<T>(_system: string, input: unknown, validator: (v: unknown) => T | null): Promise<T | null> {
        const inp = input as any;
        if (inp.userQuestion) {
          return validator({
            answer: `Because ${inp.seats.join(" and ")} see that ${inp.verdict}`
          });
        }
        return null;
      }
    };

    const { service } = await makeService(mockProvider);
    const userId = "user-explain-dynamic";

    await service.processMessage(userId, "Should I accept a client who pays more but wants weekends?");
    await service.processMessage(userId, "yes");

    const explainRes = await service.processMessage(userId, "Before I give you a deadline, explain why Future You agrees with CFO.");
    expect(explainRes.reply).toContain("Because cfo and operator and future_you see that");
    expect(explainRes.reply).toContain("You still haven't set the deadline");
    expect(explainRes.session.conversationState).toBe("AWAITING_DEADLINE");
  });

  it("G. off-script deviations: context preserving across discussion and constraints", async () => {
    const { service } = await makeService();
    const userId = "user-deviations";

    // A. User accepts, then mentions family boundary
    await service.processMessage(userId, "Scope discussion");
    await service.processMessage(userId, "deal");
    const constraintRes = await service.processMessage(
      userId,
      "I don't know. I promised my family I'd stop working early tonight."
    );
    expect(constraintRes.reply).toContain("Protect that boundary");
    expect(constraintRes.session.conversationState).toBe("AWAITING_DEADLINE");

    // Can still set deadline
    const lockRes = await service.processMessage(userId, "tomorrow at 9");
    expect(lockRes.reply).toContain("Locked.");
    expect(lockRes.session.conversationState).toBe("COMMITMENT_ACTIVE");

    // B. Partial/not done
    const partialRes = await service.processMessage(
      userId,
      "I've basically finished, but I still haven't tested the proactive message."
    );
    expect(partialRes.reply).toContain("Blocker:");
    expect(partialRes.session.conversationState).toBe("BLOCKED");

    // C. User says Board misunderstood
    const fixTaskRes = await service.processMessage(
      userId,
      "The Board misunderstood me. I only meant the scheduler, not the whole feature."
    );
    expect(fixTaskRes.reply).toContain("Commitment updated to:");
    expect(fixTaskRes.commitment?.commitment).toContain("the scheduler");
  });
});
