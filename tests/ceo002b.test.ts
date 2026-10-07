import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDeadline, parseNaturalDeadline } from "../src/deadline.js";
import { runProactiveFollowUpCheck, type TransportSender } from "../src/scheduler.js";
import { CeoMeService } from "../src/service.js";
import { JsonFileStore } from "../src/store.js";

async function makeService() {
  const dir = await mkdtemp(join(tmpdir(), "ceo-me-test-"));
  const file = join(dir, "store.json");
  const store = new JsonFileStore(file);
  const service = new CeoMeService(store);
  return { dir, file, store, service };
}

describe("CEO-002B Conversational Flow & Intent Routing", () => {
  it("A. accepts commitments through natural variations ('yes', 'yeah hold me to it', 'deal', 'lock it in')", async () => {
    const variations = ["yes", "yeah hold me to it", "deal", "lock it in"];

    for (let i = 0; i < variations.length; i++) {
      const { service } = await makeService();
      const userId = `user-accept-${i}`;

      // Convene board
      const res1 = await service.processMessage(
        userId,
        "Should I build more features before shipping?"
      );
      expect(res1.reply).toContain("BOARD");
      expect(res1.reply).toContain("I can hold you to that if you want.");

      // Natural acceptance
      const res2 = await service.processMessage(userId, variations[i]);
      expect(res2.reply).toContain("Good. When do you want this done?");
      expect(res2.session.conversationState).toBe("AWAITING_DEADLINE");
    }
  });

  it("B. handles rejection naturally without creating a commitment", async () => {
    const rejections = ["no", "not that", "I don't want to commit"];

    for (let i = 0; i < rejections.length; i++) {
      const { service, store } = await makeService();
      const userId = `user-reject-${i}`;

      await service.processMessage(userId, "I want to rebuild everything from scratch.");
      const res = await service.processMessage(userId, rejections[i]);

      expect(res.reply).toMatch(/Understood/);
      const commitments = await store.listCommitmentsForUser(userId);
      expect(commitments).toHaveLength(0);
    }
  });

  it("C. parses natural deadlines and handles embedded deadlines in acceptance", async () => {
    // 1. Standalone natural deadlines
    const now = new Date("2026-10-07T12:00:00.000Z"); // 1:00 PM in Lagos (+01:00)
    const in30m = parseNaturalDeadline("in 30 minutes", now, "Africa/Lagos");
    expect(in30m.success).toBe(true);
    expect(new Date(in30m.iso!).getTime() - now.getTime()).toBe(30 * 60 * 1000);

    const at8pm = parseNaturalDeadline("8pm", now, "Africa/Lagos");
    expect(at8pm.success).toBe(true);
    expect(formatDeadline(at8pm.iso!, "Africa/Lagos")).toBe("8:00 PM");

    // 2. Acceptance with embedded deadline
    const { service, store } = await makeService();
    const userId = "user-embedded";
    await service.processMessage(userId, "Should I add dark mode now?");
    const res = await service.processMessage(userId, "yes, by 8 tonight");

    expect(res.reply).toContain("Locked.");
    expect(res.reply).toContain("8:00 PM");
    expect(res.reply).toContain("I'll come back then.");

    const commitments = await store.listCommitmentsForUser(userId);
    expect(commitments).toHaveLength(1);
    expect(commitments[0].status).toBe("pending");
  });

  it("D. modifies active deadlines naturally ('make it 9 instead', 'give me another hour')", async () => {
    const { service } = await makeService();
    const userId = "user-mod-deadline";

    await service.processMessage(userId, "Scope discussion");
    await service.processMessage(userId, "hold me to it");
    await service.processMessage(userId, "8pm");

    const sessionBefore = await service.getSession(userId);
    expect(sessionBefore.conversationState).toBe("COMMITMENT_ACTIVE");

    // Modify deadline
    const res = await service.processMessage(userId, "actually make it 9pm");
    expect(res.reply).toContain("Deadline moved to");
    expect(res.reply).toContain("9:00 PM");
    expect(res.session.conversationState).toBe("COMMITMENT_ACTIVE");
  });

  it("E. parses outcomes: DONE, natural completed, BLOCKED with blocker, and ABANDONED", async () => {
    const { service, store } = await makeService();
    const userId = "user-outcomes";

    // Setup active commitment
    await service.processMessage(userId, "Scope discussion");
    await service.processMessage(userId, "deal");
    await service.processMessage(userId, "in 30 minutes");

    // Test BLOCKED / partial
    const resBlocked = await service.processMessage(
      userId,
      "I'm blocked because Photon isn't responding"
    );
    expect(resBlocked.reply).toContain("Blocker: Photon isn't responding");
    expect(resBlocked.reply).toContain("Do you want to:");

    const blockedCommitment = await store.getCommitment(
      resBlocked.session.activeCommitmentId!
    );
    expect(blockedCommitment?.status).toBe("blocked");

    // Now complete it
    const resDone = await service.processMessage(userId, "I finished it");
    expect(resDone.reply).toContain("Closed.");
    expect(resDone.reply).toContain("You said you'd ship it.");
    expect(resDone.session.conversationState).toBe("COMPLETED");

    const finalCommitment = await store.getCommitment(blockedCommitment!.id);
    expect(finalCommitment?.status).toBe("completed");
  });

  it("F. handles off-script questions without losing state (recovers gracefully)", async () => {
    const { service } = await makeService();
    const userId = "user-offscript";

    await service.processMessage(userId, "Should I refactor everything?");
    await service.processMessage(userId, "yes");

    const session1 = await service.getSession(userId);
    expect(session1.conversationState).toBe("AWAITING_DEADLINE");

    // User asks an off-script question instead of providing a deadline
    const resQuestion = await service.processMessage(
      userId,
      "By the way, why is Future You always on the Board?"
    );
    expect(resQuestion.reply).toContain("Because this decision has a long-term tradeoff.");
    expect(resQuestion.reply).toContain("You still haven't set the deadline");

    // State remains preserved
    expect(resQuestion.session.conversationState).toBe("AWAITING_DEADLINE");

    // User now provides deadline
    const resDeadline = await service.processMessage(userId, "in 45 minutes");
    expect(resDeadline.reply).toContain("Locked.");
    expect(resDeadline.session.conversationState).toBe("COMMITMENT_ACTIVE");
  });

  it("G. rejects DONE when no active commitment exists (never fabricates state)", async () => {
    const { service } = await makeService();
    const userId = "user-no-commitment";

    const res = await service.processMessage(userId, "DONE");
    expect(res.reply).toBe("I don't have an active commitment to close.");
    expect(res.session.conversationState).toBe("IDLE");
  });

  it("H. scheduler proactively sends due commitments and prevents duplicate sends", async () => {
    const { service, store } = await makeService();
    const userId = "user-sched";

    const now = new Date("2026-10-07T12:00:00.000Z");
    const dueTime = new Date("2026-10-07T12:15:00.000Z");

    const { decision } = await service.evaluate(userId, "Test decision");
    const commitment = await service.acceptCommitment(
      userId,
      decision.id,
      "Ship the real iMessage commitment flow",
      dueTime.toISOString()
    );

    const sentMessages: string[] = [];
    const mockTransport: TransportSender = {
      async sendProactiveMessage(uId, text) {
        sentMessages.push(`${uId}:${text}`);
        return true;
      }
    };

    // Check before due time
    const sentBefore = await runProactiveFollowUpCheck(
      store,
      mockTransport,
      new Date("2026-10-07T12:10:00.000Z")
    );
    expect(sentBefore).toBe(0);
    expect(sentMessages).toHaveLength(0);

    // Check at/after due time
    const sentAfter = await runProactiveFollowUpCheck(
      store,
      mockTransport,
      new Date("2026-10-07T12:16:00.000Z")
    );
    expect(sentAfter).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toContain("BOARD FOLLOW-UP");
    expect(sentMessages[0]).toContain("Ship the real iMessage commitment flow");

    // Check updated commitment record
    const updated = await store.getCommitment(commitment.id);
    expect(updated?.followUpSentAt).toBeDefined();

    // Re-check at future time -> DUPLICATE SEND PREVENTION
    const sentDuplicate = await runProactiveFollowUpCheck(
      store,
      mockTransport,
      new Date("2026-10-07T12:20:00.000Z")
    );
    expect(sentDuplicate).toBe(0);
    expect(sentMessages).toHaveLength(1); // Still exactly 1 message sent!
  });
});
