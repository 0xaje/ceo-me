import { randomUUID } from "node:crypto";
import type {
  CommitmentRecord,
  CommitmentStatus,
  DecisionRecord
} from "./domain.js";

export class InMemoryStore {
  private decisions = new Map<string, DecisionRecord>();
  private commitments = new Map<string, CommitmentRecord>();

  createDecision(input: Omit<DecisionRecord, "id" | "createdAt">): DecisionRecord {
    const record: DecisionRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.decisions.set(record.id, record);
    return record;
  }

  createCommitment(
    input: Omit<CommitmentRecord, "id" | "status" | "createdAt" | "updatedAt">
  ): CommitmentRecord {
    const now = new Date().toISOString();
    const record: CommitmentRecord = {
      ...input,
      id: randomUUID(),
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    this.commitments.set(record.id, record);
    return record;
  }

  updateCommitmentStatus(
    id: string,
    status: CommitmentStatus,
    outcomeNote?: string
  ): CommitmentRecord {
    const current = this.commitments.get(id);
    if (!current) {
      throw new Error(`Unknown commitment: ${id}`);
    }

    const updated: CommitmentRecord = {
      ...current,
      status,
      outcomeNote,
      updatedAt: new Date().toISOString()
    };

    this.commitments.set(id, updated);
    return updated;
  }

  getCommitment(id: string): CommitmentRecord | undefined {
    return this.commitments.get(id);
  }

  listCommitmentsForUser(userId: string): CommitmentRecord[] {
    return [...this.commitments.values()].filter((item) => item.userId === userId);
  }
}
