import type { CommitmentRecord } from "./domain.js";
import { CeoMeService } from "./service.js";

export type FollowUpEvent = {
  commitmentId: string;
  userId: string;
  message: string;
};

export async function collectDueFollowUps(
  service: CeoMeService,
  now = new Date()
): Promise<FollowUpEvent[]> {
  const due = await service.dueCommitments(now);

  return due.map((commitment: CommitmentRecord) => ({
    commitmentId: commitment.id,
    userId: commitment.userId,
    message:
      "BOARD FOLLOW-UP\n\nWe voted.\nYou agreed.\n\nDid you complete: " +
      commitment.commitment +
      "?\n\nReply DONE, BLOCKED, or ABANDONED."
  }));
}
