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

describe("CEO-002B Correctness & Natural Conversational Flow", () => {
  it("A. blocked commitment reschedules, restores pending status, and receives next proactive follow-up", async () => {
    const { service, store } = await makeService();
    const userId = "user-blocked-resched";

    // 1. Initial decision -> acceptance -> deadline
    await service.processMessage(userId, "Scope dilemma");
    await service.processMessage(userId, "hold me to it");
    const commitRes = await service.processMessage(userId, "in 10 minutes");
    const commitmentId = commitRes.session.activeCommitmentId!;

    // 2. Report blocked with partial completion
    const blockedRes = await service.processMessage(
      userId,
      "mostly done, but the scheduler still needs work"
    );
    expect(blockedRes.reply).toContain("Blocker: the scheduler still needs work");
    expect(blockedRes.reply).toContain("Do you want to:");

    let stored = await store.getCommitment(commitmentId);
    expect(stored?.status).toBe("blocked");
    expect(stored?.blocker).toBe("the scheduler still needs work");

    // 3. Move deadline ("actually make it 9pm")
    const moveRes = await service.processMessage(userId, "actually make it 9pm");
    expect(moveRes.reply).toContain("Deadline moved to 9:00 PM");
    expect(moveRes.session.conversationState).toBe("COMMITMENT_ACTIVE");

    // 4. Verify commitment is restored to pending status and schedulable
    stored = await store.getCommitment(commitmentId);
    expect(stored?.status).toBe("pending");
    expect(stored?.followUpSentAt).toBeUndefined();

    // 5. Verify it appears in due commitments when deadline arrives
    const sentMessages: string[] = [];
    const mockTransport: TransportSender = {
      async sendProactiveMessage(uId, text) {
        sentMessages.push(`${uId}:${text}`);
        return true;
      }
    };

    const futureDue = new Date(stored!.dueAt);
    const sentCount = await runProactiveFollowUpCheck(
      store,
      mockTransport,
      new Date(futureDue.getTime() + 1000)
    );

    expect(sentCount).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toContain("BOARD FOLLOW-UP");

    // 6. DONE closes it cleanly
    const doneRes = await service.processMessage(userId, "done now");
    expect(doneRes.reply).toContain("Closed.");
    stored = await store.getCommitment(commitmentId);
    expect(stored?.status).toBe("completed");
  });

  it("B. blocked follow-up options: KEEP deadline and RECONVENE Board", async () => {
    // 1. Test KEEP deadline
    const { service: s1, store: st1 } = await makeService();
    const u1 = "user-keep";
    await s1.processMessage(u1, "Build flow");
    await s1.processMessage(u1, "deal");
    const c1 = await s1.processMessage(u1, "in 30 minutes");
    await s1.processMessage(u1, "I'm blocked because Photon webhook auth failed");
    const keepRes = await s1.processMessage(u1, "keep the deadline");
    expect(keepRes.reply).toContain("Keeping original deadline");
    expect(keepRes.session.conversationState).toBe("COMMITMENT_ACTIVE");

    // 2. Test RECONVENE Board
    const { service: s2 } = await makeService();
    const u2 = "user-reconvene";
    await s2.processMessage(u2, "Build flow");
    await s2.processMessage(u2, "deal");
    await s2.processMessage(u2, "in 30 minutes");
    await s2.processMessage(u2, "I'm blocked because Photon webhook auth failed");
    const reconveneRes = await s2.processMessage(u2, "reconvene the board");
    expect(reconveneRes.reply).toContain("BOARD RECONVENED");
    expect(reconveneRes.reply).toContain("VERDICT");
    expect(reconveneRes.session.conversationState).toBe("BLOCKED");
  });

  it("C. abandonment captures and persists reason across dedicated turn", async () => {
    const { service, store } = await makeService();
    const userId = "user-abandon";

    await service.processMessage(userId, "New experiment");
    await service.processMessage(userId, "yes");
    const cRes = await service.processMessage(userId, "8pm");
    const commitmentId = cRes.session.activeCommitmentId!;

    // Step 1: User indicates abandonment
    const dropRes = await service.processMessage(userId, "I gave up");
    expect(dropRes.reply).toContain("Why did you drop it?");
    expect(dropRes.session.conversationState).toBe("AWAITING_ABANDON_REASON");

    // Step 2: User provides reason on the next turn
    const reasonText = "I realized the integration wasn't worth the scope.";
    const reasonRes = await service.processMessage(userId, reasonText);
    expect(reasonRes.reply).toContain("Recorded.");
    expect(reasonRes.reply).toContain("Mission dropped.");
    expect(reasonRes.session.conversationState).toBe("ABANDONED");

    // Verify persisted reason on commitment
    const record = await store.getCommitment(commitmentId);
    expect(record?.status).toBe("abandoned");
    expect(record?.outcomeNote).toBe(reasonText);
  });

  it("D. weekday parsing and relative meal rollover", async () => {
    // Current time: Wednesday, Oct 7, 2026 at 2:00 PM (14:00) in Lagos (+01:00)
    const now = new Date("2026-10-07T13:00:00.000Z"); // 14:00 in Lagos

    // Friday at 5pm
    const fri = parseNaturalDeadline("Friday at 5", now, "Africa/Lagos");
    expect(fri.success).toBe(true);
    expect(formatDeadline(fri.iso!, "Africa/Lagos")).toBe("5:00 PM");
    const friDate = new Date(fri.iso!);
    expect(friDate.getUTCDay()).toBe(5); // Friday

    // "next Friday at 5"
    const nextFri = parseNaturalDeadline("next Friday at 5", now, "Africa/Lagos");
    expect(nextFri.success).toBe(true);
    expect(new Date(nextFri.iso!).getTime()).toBeGreaterThan(friDate.getTime());

    // Relative meal periods: "before lunch" (12:30 PM). Since it is 2:00 PM today, it rolls to tomorrow!
    const lunch = parseNaturalDeadline("before lunch", now, "Africa/Lagos");
    expect(lunch.success).toBe(true);
    expect(new Date(lunch.iso!).getTime()).toBeGreaterThan(now.getTime());
    expect(formatDeadline(lunch.iso!, "Africa/Lagos")).toBe("12:30 PM");

    // "by midnight"
    const midnight = parseNaturalDeadline("by midnight", now, "Africa/Lagos");
    expect(midnight.success).toBe(true);
    expect(new Date(midnight.iso!).getTime()).toBeGreaterThan(now.getTime());
  });

  it("E. off-script deviations: questions and task changes preserve context", async () => {
    const { service } = await makeService();
    const userId = "user-offscript-detail";

    // 1. Off-script question during deadline
    await service.processMessage(userId, "Scope dilemma");
    await service.processMessage(userId, "yes");
    const qRes = await service.processMessage(userId, "Why is Operator on the board?");
    expect(qRes.reply).toContain("Because someone has to keep scope tight");
    expect(qRes.reply).toContain("You still haven't set the deadline");
    expect(qRes.session.conversationState).toBe("AWAITING_DEADLINE");

    // 2. Set deadline
    await service.processMessage(userId, "tomorrow at 8");
    const session = await service.getSession(userId);
    expect(session.conversationState).toBe("COMMITMENT_ACTIVE");

    // 3. Question about active agreement
    const whatRes = await service.processMessage(userId, "what exactly did I agree to?");
    expect(whatRes.reply).toContain("You agreed to:");
    expect(whatRes.session.conversationState).toBe("COMMITMENT_ACTIVE");

    // 4. Modify commitment task
    const modRes = await service.processMessage(
      userId,
      "actually change the task to finish only the scheduler"
    );
    expect(modRes.reply).toContain("Commitment updated to: \"finish only the scheduler\"");
    expect(modRes.commitment?.commitment).toBe("finish only the scheduler");
  });

  it("F. general Muse dilemmas handled by board reasoning engine", async () => {
    const { service } = await makeService();

    // Dilemma 1: Freelance client paying more vs weekend work
    const d1 = await service.evaluate(
      "user-muse-1",
      "Should I accept a freelance client who pays more but wants weekend work?"
    );
    expect(d1.board.verdict).toContain("Do not surrender weekends for marginal pay");

    // Dilemma 2: Two hackathons
    const d2 = await service.evaluate(
      "user-muse-2",
      "I have two hackathons due this week. Which one should I finish first?"
    );
    expect(d2.board.verdict).toContain("Kill split attention");

    // Dilemma 3: Buying hardware
    const d3 = await service.evaluate(
      "user-muse-3",
      "Should I buy a new laptop now or wait?"
    );
    expect(d3.board.verdict).toContain("buy the tool");
  });

  it("G. concurrent store mutations do not drop data (mutex serialized)", async () => {
    const { store } = await makeService();

    // Run 25 parallel create operations
    const promises = Array.from({ length: 25 }, (_, i) =>
      store.createCommitment({
        userId: `user-concurrent-${i}`,
        decisionId: `dec-${i}`,
        commitment: `Task ${i}`,
        dueAt: new Date().toISOString()
      })
    );

    await Promise.all(promises);

    const due = await store.listDueCommitments(new Date(Date.now() + 10000));
    expect(due).toHaveLength(25);
  });
});
