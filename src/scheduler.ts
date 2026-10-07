import type { CommitmentRecord } from "./domain.js";
import { CeoMeService } from "./service.js";
import type { CeoStore } from "./store.js";

export type FollowUpEvent = {
  commitmentId: string;
  userId: string;
  message: string;
};

export interface TransportSender {
  sendProactiveMessage(userId: string, text: string): Promise<boolean>;
}

function cleanCommitmentLabel(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

export function formatFollowUpPrompt(commitmentText: string): string {
  return (
    "BOARD FOLLOW-UP\n\n" +
    "We voted.\n" +
    "You agreed.\n\n" +
    `Did you complete: ${cleanCommitmentLabel(commitmentText)}?\n\n` +
    "DONE\n" +
    "BLOCKED\n" +
    "ABANDONED"
  );
}

export async function collectDueFollowUps(
  service: CeoMeService,
  now = new Date()
): Promise<FollowUpEvent[]> {
  const due = await service.dueCommitments(now);

  return due.map((commitment: CommitmentRecord) => ({
    commitmentId: commitment.id,
    userId: commitment.userId,
    message: formatFollowUpPrompt(commitment.commitment)
  }));
}

/**
 * Runs proactive check for due commitments, sends real follow-up messages via transport,
 * updates conversation state to FOLLOW_UP_DUE, and persists followUpSentAt to prevent duplicate sends.
 */
export async function runProactiveFollowUpCheck(
  store: CeoStore,
  transport: TransportSender,
  now = new Date()
): Promise<number> {
  const due = await store.listDueCommitments(now);
  let sentCount = 0;

  for (const commitment of due) {
    // Deduplication check: if already sent, skip immediately
    if (commitment.followUpSentAt) {
      continue;
    }

    const message = formatFollowUpPrompt(commitment.commitment);
    try {
      const delivered = await transport.sendProactiveMessage(
        commitment.userId,
        message
      );

      if (delivered) {
        const sentAt = new Date().toISOString();
        await store.recordFollowUpResult(commitment.id, { sentAt });

        // Update session state to FOLLOW_UP_DUE
        const session = await store.getUserSession(commitment.userId);
        session.conversationState = "FOLLOW_UP_DUE";
        session.activeCommitmentId = commitment.id;
        await store.saveUserSession(session);

        sentCount++;
      } else {
        await store.recordFollowUpResult(commitment.id, {
          error: "Transport could not route or deliver"
        });
      }
    } catch (error) {
      console.error(
        `Failed to send proactive follow-up for commitment ${commitment.id}:`,
        error
      );
      await store.recordFollowUpResult(commitment.id, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return sentCount;
}

export class ProactiveSchedulerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor(
    private readonly store: CeoStore,
    private readonly transport: TransportSender,
    private readonly intervalMs = 15000 // default check every 15 seconds
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      if (this.isChecking) return;
      this.isChecking = true;
      try {
        await runProactiveFollowUpCheck(this.store, this.transport);
      } catch (err) {
        console.error("Error in proactive scheduler check:", err);
      } finally {
        this.isChecking = false;
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
