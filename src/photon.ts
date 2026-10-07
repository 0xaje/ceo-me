import { resolve } from "node:path";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { ProactiveSchedulerWorker, type TransportSender } from "./scheduler.js";
import { CeoMeService } from "./service.js";
import { JsonFileStore } from "./store.js";

const projectId = process.env.SPECTRUM_PROJECT_ID ?? process.env.PROJECT_ID;
const projectSecret = process.env.SPECTRUM_PROJECT_SECRET ?? process.env.PROJECT_SECRET;

if (!projectId || !projectSecret) {
  console.error(
    "Missing Photon credentials. Set SPECTRUM_PROJECT_ID (or PROJECT_ID) and SPECTRUM_PROJECT_SECRET (or PROJECT_SECRET) before running npm run photon."
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

const im = imessage(app);

// In-memory cache of active Space instances per spaceId for real-time proactive delivery
const activeSpaces = new Map<string, any>();

// Real MessagingTransport using Spectrum/Photon iMessage provider
const transport: TransportSender = {
  async sendProactiveMessage(userId: string, text: string): Promise<boolean> {
    const session = await store.getUserSession(userId);
    const spaceId = session.routing?.spaceId;
    if (!spaceId) {
      console.warn(`No stored routing spaceId for user: ${userId}`);
      return false;
    }

    try {
      // 1. Try in-memory cached space from active session
      let space = activeSpaces.get(spaceId);

      // 2. If not in memory, re-hydrate via im.space.get(spaceId)
      if (!space) {
        space = await im.space.get(spaceId);
        activeSpaces.set(spaceId, space);
      }

      if (!space || typeof space.send !== "function") {
        console.error(`Unable to resolve space for spaceId: ${spaceId}`);
        return false;
      }

      await space.responding(async () => {
        await space.send(text);
      });

      console.log(`[PROACTIVE] Sent / accepted by transport for user ${userId} in space ${spaceId}`);
      return true;
    } catch (err) {
      console.error(`[PROACTIVE] Failed to send message to ${userId}:`, err);
      return false;
    }
  }
};

// Start proactive background scheduler (runs check every 5 seconds)
const schedulerWorker = new ProactiveSchedulerWorker(store, transport, 5000);
schedulerWorker.start();

console.log("CEO Me is listening for Photon iMessages (with proactive follow-up worker enabled)...");

for await (const [space, message] of app.messages) {
  if (message.direction === "outbound") continue;
  if (message.content.type !== "text") continue;

  const text = message.content.text.trim();
  if (!text) continue;

  const userId = message.sender?.id ?? `imessage-space:${space.id}`;

  // Keep space in memory for proactive follow-ups
  activeSpaces.set(space.id, space);

  // Persist routing identity to disk
  await store.saveUserRouting(userId, {
    spaceId: space.id,
    platform: "imessage",
    phone: (space as any).phone,
    updatedAt: new Date().toISOString()
  });

  try {
    // Quick ping check
    if (text.toLowerCase() === "ping") {
      await message.react("👍");
      await space.responding(async () => {
        await message.reply("CEO Me is online.");
      });
      continue;
    }

    // Process conversational flow
    const result = await service.processMessage(userId, text);

    if (result.reaction) {
      try {
        await message.react(result.reaction);
      } catch {
        // Tapback is best-effort
      }
    }

    await space.responding(async () => {
      await message.reply(result.reply);
    });
  } catch (error) {
    console.error("Failed to process inbound Photon message:", error);

    try {
      await message.reply(
        "The Board hit an internal error. Nothing was recorded as completed."
      );
    } catch {
      // If transport failed, ignore secondary error
    }
  }
}
