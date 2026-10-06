import { resolve } from "node:path";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { CeoMeService } from "./service.js";
import { JsonFileStore } from "./store.js";

const projectId = process.env.PROJECT_ID;
const projectSecret = process.env.PROJECT_SECRET;

if (!projectId || !projectSecret) {
  console.error(
    "Missing Photon credentials. Set PROJECT_ID and PROJECT_SECRET before running npm run photon."
  );
  process.exit(1);
}

const store = new JsonFileStore(resolve("data/ceo-me.json"));
const service = new CeoMeService(store);

const app = await Spectrum({
  projectId,
  projectSecret,
  providers: [imessage.config()]
});

console.log("CEO Me is listening for Photon iMessages...");

for await (const [space, message] of app.messages) {
  if (message.direction === "outbound") continue;
  if (message.content.type !== "text") continue;

  const text = message.content.text.trim();
  if (!text) continue;

  const userId = message.sender?.id ?? `imessage-space:${space.id}`;

  try {
    await message.react("👍");

    await space.responding(async () => {
      if (text.toLowerCase() === "ping") {
        await message.reply("CEO Me is online.");
        return;
      }

      const { board } = await service.evaluate(userId, text);

      const seats = board.seats
        .map((seat) => seat.replaceAll("_", " ").toUpperCase())
        .join(" · ");

      const commitment = board.suggestedCommitment
        ? `\n\nSUGGESTED COMMITMENT\n${board.suggestedCommitment}`
        : "";

      const response =
        `BOARD\n${seats}\n\n` +
        `CEO VERDICT\n${board.verdict}\n\n` +
        `FIRST MOVE\n${board.firstAction}` +
        commitment;

      await message.reply(response);
    });
  } catch (error) {
    console.error("Failed to process inbound Photon message:", error);

    try {
      await message.reply(
        "The Board hit an internal error. Nothing was recorded as completed."
      );
    } catch {
      // If the transport itself failed, do not pretend a reply was delivered.
    }
  }
}
