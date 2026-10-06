import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CeoMeService } from "../src/service.js";
import { collectDueFollowUps } from "../src/scheduler.js";
import { JsonFileStore } from "../src/store.js";

async function makeService() {
  const dir = await mkdtemp(join(tmpdir(), "ceo-me-"));
  const file = join(dir, "store.json");
  return { file, service: new CeoMeService(new JsonFileStore(file)) };
}

describe("CEO-001 persistence and follow-up", () => {
  it("turns scope expansion into one clear verdict", async () => {
    const { service } = await makeService();

    const { board } = await service.evaluate(
      "user-1",
      "Should I add a dashboard and more features before I record the demo?"
    );

    expect(board.verdict).toContain("Stop expanding scope");
    expect(board.firstAction).toContain("decision");
  });

  it("persists a commitment to disk", async () => {
    const { file, service } = await makeService();

    const { decision } = await service.evaluate("user-1", "I need to finish CEO-001.");
    const commitment = await service.acceptCommitment(
      "user-1",
      decision.id,
      "Ship CEO-001",
      "2026-10-06T21:00:00+01:00"
    );

    const raw = await readFile(file, "utf8");
    expect(raw).toContain(commitment.id);
    expect(raw).toContain("Ship CEO-001");
  });

  it("emits follow-up only when the stored commitment is due", async () => {
    const { service } = await makeService();

    const { decision } = await service.evaluate("user-1", "Finish the loop.");
    await service.acceptCommitment(
      "user-1",
      decision.id,
      "Ship CEO-001.",
      "2026-10-06T21:00:00+01:00"
    );

    const before = await collectDueFollowUps(
      service,
      new Date("2026-10-06T20:59:00+01:00")
    );
    expect(before).toHaveLength(0);

    const after = await collectDueFollowUps(
      service,
      new Date("2026-10-06T21:01:00+01:00")
    );
    expect(after).toHaveLength(1);
    expect(after[0].message).toContain("BOARD FOLLOW-UP");
    expect(after[0].message).toContain("Did you complete: Ship CEO-001?");
    expect(after[0].message).not.toContain(".?");
  });

  it("records a real outcome and stops future follow-ups", async () => {
    const { service } = await makeService();

    const { decision } = await service.evaluate("user-1", "Finish the loop.");
    const commitment = await service.acceptCommitment(
      "user-1",
      decision.id,
      "Ship CEO-001",
      "2026-10-06T21:00:00+01:00"
    );

    await service.recordOutcome(
      commitment.id,
      "completed",
      "User reported DONE."
    );

    const after = await collectDueFollowUps(
      service,
      new Date("2026-10-06T21:05:00+01:00")
    );

    expect(after).toHaveLength(0);
  });
});
