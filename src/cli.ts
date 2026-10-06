import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { CeoMeService } from "./service.js";
import { collectDueFollowUps } from "./scheduler.js";
import { JsonFileStore } from "./store.js";

const rl = createInterface({ input, output });
const store = new JsonFileStore(resolve("data/ceo-me.json"));
const service = new CeoMeService(store);
const userId = "local-user";

const due = await collectDueFollowUps(service);
for (const event of due) {
  console.log("\n" + event.message + "\n");
}

const message = await rl.question("YOU: ");
const result = await service.evaluate(userId, message);

console.log("\nBOARD");
for (const seat of result.board.seats) {
  console.log(`- ${seat}`);
}

console.log(`\nCEO VERDICT\n${result.board.verdict}`);
console.log(`\nFIRST MOVE\n${result.board.firstAction}`);

if (result.board.suggestedCommitment) {
  console.log(`\nSUGGESTED COMMITMENT\n${result.board.suggestedCommitment}`);
  const answer = (await rl.question("\nAccept this commitment? (yes/no): ")).trim().toLowerCase();

  if (answer === "yes" || answer === "y") {
    const dueInput = await rl.question(
      "Deadline (ISO, e.g. 2026-10-06T21:00:00+01:00): "
    );

    const parsed = new Date(dueInput);
    if (Number.isNaN(parsed.getTime())) {
      console.error("Invalid deadline. Commitment was not created.");
    } else {
      const commitment = await service.acceptCommitment(
        userId,
        result.decision.id,
        result.board.suggestedCommitment,
        parsed.toISOString()
      );
      console.log(`\nCOMMITMENT SAVED\nID: ${commitment.id}\nDue: ${commitment.dueAt}`);
    }
  }
}

await rl.close();
