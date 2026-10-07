import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  CommitmentRecord,
  CommitmentStatus,
  DecisionRecord,
  UserRouting,
  UserSessionRecord
} from "./domain.js";

type StoreSnapshot = {
  decisions: DecisionRecord[];
  commitments: CommitmentRecord[];
  sessions?: Record<string, UserSessionRecord>;
};

export interface CeoStore {
  createDecision(input: Omit<DecisionRecord, "id" | "createdAt">): Promise<DecisionRecord>;
  getDecision(id: string): Promise<DecisionRecord | undefined>;
  listDecisionsForUser(userId: string): Promise<DecisionRecord[]>;

  createCommitment(
    input: Omit<CommitmentRecord, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<CommitmentRecord>;
  updateCommitmentStatus(
    id: string,
    status: CommitmentStatus,
    outcomeNote?: string
  ): Promise<CommitmentRecord>;
  updateCommitmentDeadline(id: string, dueAt: string): Promise<CommitmentRecord>;
  recordFollowUpResult(
    id: string,
    result: { sentAt?: string; error?: string }
  ): Promise<CommitmentRecord>;
  getCommitment(id: string): Promise<CommitmentRecord | undefined>;
  listCommitmentsForUser(userId: string): Promise<CommitmentRecord[]>;
  listDueCommitments(now: Date): Promise<CommitmentRecord[]>;

  getUserSession(userId: string): Promise<UserSessionRecord>;
  saveUserSession(session: UserSessionRecord): Promise<UserSessionRecord>;
  saveUserRouting(userId: string, routing: UserRouting): Promise<void>;
  listActiveRoutingSessions(): Promise<UserSessionRecord[]>;
}

export class JsonFileStore implements CeoStore {
  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreSnapshot> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const data = JSON.parse(raw) as StoreSnapshot;
      if (!data.decisions) data.decisions = [];
      if (!data.commitments) data.commitments = [];
      if (!data.sessions) data.sessions = {};
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { decisions: [], commitments: [], sessions: {} };
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

  async getDecision(id: string): Promise<DecisionRecord | undefined> {
    const snapshot = await this.load();
    return snapshot.decisions.find((item) => item.id === id);
  }

  async listDecisionsForUser(userId: string): Promise<DecisionRecord[]> {
    const snapshot = await this.load();
    return snapshot.decisions.filter((item) => item.userId === userId);
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

  async updateCommitmentDeadline(id: string, dueAt: string): Promise<CommitmentRecord> {
    const snapshot = await this.load();
    const index = snapshot.commitments.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Unknown commitment: ${id}`);
    }

    const updated: CommitmentRecord = {
      ...snapshot.commitments[index],
      dueAt,
      // Reset followUpSentAt so follow up fires at the new deadline
      followUpSentAt: undefined,
      updatedAt: new Date().toISOString()
    };

    snapshot.commitments[index] = updated;
    await this.save(snapshot);
    return updated;
  }

  async recordFollowUpResult(
    id: string,
    result: { sentAt?: string; error?: string }
  ): Promise<CommitmentRecord> {
    const snapshot = await this.load();
    const index = snapshot.commitments.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Unknown commitment: ${id}`);
    }

    const updated: CommitmentRecord = {
      ...snapshot.commitments[index],
      followUpSentAt: result.sentAt,
      followUpError: result.error,
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
      (item) =>
        item.status === "pending" &&
        !item.followUpSentAt &&
        new Date(item.dueAt).getTime() <= now.getTime()
    );
  }

  async getUserSession(userId: string): Promise<UserSessionRecord> {
    const snapshot = await this.load();
    const existing = snapshot.sessions?.[userId];
    if (existing) {
      return existing;
    }
    return {
      userId,
      conversationState: "IDLE",
      updatedAt: new Date().toISOString()
    };
  }

  async saveUserSession(session: UserSessionRecord): Promise<UserSessionRecord> {
    const snapshot = await this.load();
    if (!snapshot.sessions) snapshot.sessions = {};
    const updated: UserSessionRecord = {
      ...session,
      updatedAt: new Date().toISOString()
    };
    snapshot.sessions[session.userId] = updated;
    await this.save(snapshot);
    return updated;
  }

  async saveUserRouting(userId: string, routing: UserRouting): Promise<void> {
    const session = await this.getUserSession(userId);
    session.routing = routing;
    await this.saveUserSession(session);
  }

  async listActiveRoutingSessions(): Promise<UserSessionRecord[]> {
    const snapshot = await this.load();
    return Object.values(snapshot.sessions || {}).filter((s) => s.routing?.spaceId);
  }
}
