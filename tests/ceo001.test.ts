import { describe, expect, it } from "vitest";
import { CeoMeService } from "../src/service.js";
import { InMemoryStore } from "../src/store.js";

describe("CEO-001 foundation", () => {
  it("turns scope expansion into one clear verdict", () => {
    const service = new CeoMeService(new InMemoryStore());

    const { board } = service.evaluate(
      "user-1",
      "Should I add a dashboard and more features before I record the demo?"
    );

    expect(board.verdict).toContain("Stop expanding scope");
    expect(board.firstAction).toContain("decision");
  });

  it("persists a commitment and its real outcome", () => {
    const store = new InMemoryStore();
    const service = new CeoMeService(store);

    const { decision } = service.evaluate("user-1", "I need to finish CEO-001.");

    const commitment = service.acceptCommitment(
      "user-1",
      decision.id,
      "Ship CEO-001",
      "2026-10-06T21:00:00+01:00"
    );

    expect(commitment.status).toBe("pending");

    const completed = service.recordOutcome(
      commitment.id,
      "completed",
      "Core loop implemented."
    );

    expect(completed.status).toBe("completed");
    expect(store.getCommitment(commitment.id)?.outcomeNote).toBe(
      "Core loop implemented."
    );
  });
});
