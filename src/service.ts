import { createDeterministicVerdict } from "./board.js";
import type { CeoStore } from "./store.js";

export class CeoMeService {
  constructor(private readonly store: CeoStore) {}

  async evaluate(userId: string, input: string) {
    const board = createDeterministicVerdict(input);

    const decision = await this.store.createDecision({
      userId,
      input,
      seats: board.seats,
      verdict: board.verdict,
      firstAction: board.firstAction
    });

    return { decision, board };
  }

  async acceptCommitment(
    userId: string,
    decisionId: string,
    commitment: string,
    dueAt: string
  ) {
    return this.store.createCommitment({
      userId,
      decisionId,
      commitment,
      dueAt
    });
  }

  async recordOutcome(
    commitmentId: string,
    outcome: "completed" | "blocked" | "abandoned",
    note?: string
  ) {
    return this.store.updateCommitmentStatus(commitmentId, outcome, note);
  }

  async dueCommitments(now = new Date()) {
    return this.store.listDueCommitments(now);
  }
}
