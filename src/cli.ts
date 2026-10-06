import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { CeoMeService } from "./service.js";
import { InMemoryStore } from "./store.js";

const rl = createInterface({ input, output });
const service = new CeoMeService(new InMemoryStore());

const message = await rl.question("YOU: ");
const result = service.evaluate("local-user", message);

console.log("\nBOARD");
for (const seat of result.board.seats) {
  console.log(`- ${seat}`);
}

console.log(`\nCEO VERDICT\n${result.board.verdict}`);
console.log(`\nFIRST MOVE\n${result.board.firstAction}`);

if (result.board.suggestedCommitment) {
  console.log(`\nSUGGESTED COMMITMENT\n${result.board.suggestedCommitment}`);
}

await rl.close();
