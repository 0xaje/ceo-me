import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  CommitmentRecord,
  CommitmentStatus,
  DecisionRecord
} from "./domain.js";

type StoreSnapshot = {
  decisions: DecisionRecord[];
  commitments: CommitmentRecord[];
};

export interface CeoStore {
  createDecision(input: Omit<DecisionRecord, "id" | "createdAt">): Promise<DecisionRecord>;
  createCommitment(
    input: Omit<CommitmentRecord, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<CommitmentRecord>;
  updateCommitmentStatus(
    id: string,
    status: CommitmentStatus,
    outcomeNote?: string
  ): Promise<CommitmentRecord>;
  getCommitment(id: string): Promise<CommitmentRecord | undefined>;
  listCommitmentsForUser(userId: string): Promise<CommitmentRecord[]>;
  listDueCommitments(now: Date): Promise<CommitmentRecord[]>;
}

export class JsonFileStore implements CeoStore {
  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreSnapshot> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as StoreSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { decisions: [], commitments: [] };
      }
      throw error;
    }
  }

  private async save(snapshot: StoreSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  }

  async createDecision(
    input: Omit<DecisionRecord, "id" | "createdAt">
  ): Promise<DecisionRecord> {
    const snapshot = await this.load();
    const record: DecisionRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    snapshot.decisions.push(record);
    await this.save(snapshot);
    return record;
  }

  async createCommitment(
    input: Omit<CommitmentRecord, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<CommitmentRecord> {
    const snapshot = await this.load();
    const now = new Date().toISOString();
    const record: CommitmentRecord = {
      ...input,
      id: randomUUID(),
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    snapshot.commitments.push(record);
    await this.save(snapshot);
    return record;
  }

  async updateCommitmentStatus(
    id: string,
    status: CommitmentStatus,
    outcomeNote?: string
  ): Promise<CommitmentRecord> {
    const snapshot = await this.load();
    const index = snapshot.commitments.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Unknown commitment: ${id}`);
    }

    const updated: CommitmentRecord = {
      ...snapshot.commitments[index],
      status,
      outcomeNote,
      updatedAt: new Date().toISOString()
    };

    snapshot.commitments[index] = updated;
    await this.save(snapshot);
    return updated;
  }

  async getCommitment(id: string): Promise<CommitmentRecord | undefined> {
    const snapshot = await this.load();
    return snapshot.commitments.find((item) => item.id === id);
  }

  async listCommitmentsForUser(userId: string): Promise<CommitmentRecord[]> {
    const snapshot = await this.load();
    return snapshot.commitments.filter((item) => item.userId === userId);
  }

  async listDueCommitments(now: Date): Promise<CommitmentRecord[]> {
    const snapshot = await this.load();
    return snapshot.commitments.filter(
      (item) => item.status === "pending" && new Date(item.dueAt).getTime() <= now.getTime()
    );
  }
}
