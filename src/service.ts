import { createDeterministicVerdict } from "./board.js";
import { InMemoryStore } from "./store.js";

export class CeoMeService {
  constructor(private readonly store: InMemoryStore) {}

  evaluate(userId: string, input: string) {
    const board = createDeterministicVerdict(input);

    const decision = this.store.createDecision({
      userId,
      input,
      seats: board.seats,
      verdict: board.verdict,
      firstAction: board.firstAction
    });

    return { decision, board };
  }

  acceptCommitment(
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

  recordOutcome(
    commitmentId: string,
    outcome: "completed" | "blocked" | "abandoned",
    note?: string
  ) {
    return this.store.updateCommitmentStatus(commitmentId, outcome, note);
  }
}
