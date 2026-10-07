import {
  DynamicBoardEngine,
  selectBoard,
  type BoardReasoningEngine
} from "./board.js";
import { formatDeadline } from "./deadline.js";
import type {
  CommitmentRecord,
  DecisionRecord,
  UserSessionRecord
} from "./domain.js";
import {
  TwoLayerIntentRouter,
  type IntentClassifier
} from "./router.js";
import type { CeoStore } from "./store.js";

export interface ProcessMessageResult {
  reply: string;
  reaction?: string;
  session: UserSessionRecord;
  decision?: DecisionRecord;
  commitment?: CommitmentRecord;
}

export class CeoMeService {
  constructor(
    private readonly store: CeoStore,
    private readonly boardEngine: BoardReasoningEngine = new DynamicBoardEngine(),
    private readonly router: IntentClassifier = new TwoLayerIntentRouter()
  ) {}

  async evaluate(userId: string, input: string) {
    const seats = selectBoard(input);
    const board = await this.boardEngine.generateVerdict({
      userMessage: input,
      selectedSeats: seats
    });

    const decision = await this.store.createDecision({
      userId,
      input,
      seats: board.seats,
      verdict: board.verdict,
      firstAction: board.firstAction,
      suggestedCommitment: board.suggestedCommitment
    });

    return { decision, board };
  }

  async acceptCommitment(
    userId: string,
    decisionId: string,
    commitment: string,
    dueAt: string
  ) {
    return this.store.createCommitment({
      userId,
      decisionId,
      commitment,
      dueAt
    });
  }

  async updateCommitmentDeadline(commitmentId: string, dueAt: string) {
    return this.store.updateCommitmentDeadline(commitmentId, dueAt);
  }

  async recordOutcome(
    commitmentId: string,
    outcome: "completed" | "blocked" | "abandoned",
    note?: string
  ) {
    return this.store.updateCommitmentStatus(commitmentId, outcome, note);
  }

  async dueCommitments(now = new Date()) {
    return this.store.listDueCommitments(now);
  }

  async getSession(userId: string): Promise<UserSessionRecord> {
    return this.store.getUserSession(userId);
  }

  /**
   * Status overview query based on real stored records
   */
  async getStatusOverview(userId: string): Promise<string> {
    const commitments = await this.store.listCommitmentsForUser(userId);
    if (commitments.length === 0) {
      return "No commitments recorded yet. Send a decision to convene the Board.";
    }

    const last5 = commitments.slice(-5);
    const completed = last5.filter((c) => c.status === "completed").length;
    const blocked = last5.filter((c) => c.status === "blocked").length;
    const abandoned = last5.filter((c) => c.status === "abandoned").length;

    let response =
      `Last ${last5.length} commitment${last5.length === 1 ? "" : "s"}:\n` +
      `${completed} completed\n` +
      `${blocked} blocked\n` +
      `${abandoned} abandoned`;

    if (completed === last5.length && last5.length >= 2) {
      response += "\n\nPattern: 100% completion rate on your recent commitments.";
    }

    return response;
  }

  /**
   * The core conversational processor
   */
  async processMessage(
    userId: string,
    text: string,
    now = new Date()
  ): Promise<ProcessMessageResult> {
    const session = await this.store.getUserSession(userId);
    let activeCommitment: CommitmentRecord | undefined;
    let activeDecision: DecisionRecord | undefined;

    if (session.activeCommitmentId) {
      activeCommitment = await this.store.getCommitment(session.activeCommitmentId);
    }
    if (session.activeDecisionId) {
      activeDecision = await this.store.getDecision(session.activeDecisionId);
    }

    // STATE: AWAITING_ABANDON_REASON -> Capture user's abandonment explanation
    if (session.conversationState === "AWAITING_ABANDON_REASON") {
      const abandonReason = text.trim();
      let updatedCommitment: CommitmentRecord | undefined;

      if (session.activeCommitmentId) {
        updatedCommitment = await this.store.updateCommitmentStatus(
          session.activeCommitmentId,
          "abandoned",
          abandonReason
        );
      }

      session.conversationState = "ABANDONED";
      session.activeCommitmentId = undefined;
      session.activeDecisionId = undefined;
      await this.store.saveUserSession(session);

      return {
        reply: "Recorded.\n\nMission dropped. I'll remember the reasoning for next time.",
        session,
        commitment: updatedCommitment
      };
    }

    // Classify intent using the two-layer router
    const classified = await this.router.classify(text, {
      conversationState: session.conversationState,
      hasActiveDecision: !!session.activeDecisionId,
      hasActiveCommitment: !!session.activeCommitmentId,
      activeCommitmentText: activeCommitment?.commitment,
      suggestedCommitmentText:
        session.pendingCommitmentDraft || activeDecision?.suggestedCommitment
    });

    session.lastIntent = classified.intent;

    // Handle off-script explanation queries
    if (classified.intent === "ASK_EXPLANATION") {
      const lower = text.toLowerCase();
      let answer = "";
      if (lower.includes("future you")) {
        answer = "Because this decision has a long-term tradeoff.";
      } else if (lower.includes("cfo")) {
        answer = "Because resource allocation and cash runway are on the line.";
      } else if (lower.includes("creative")) {
        answer = "Because presentation, tone, and brand perception matter here.";
      } else if (lower.includes("operator")) {
        answer = "Because someone has to keep scope tight and ensure execution.";
      } else if (
        lower.includes("what exactly did i agree to") ||
        lower.includes("what did i commit to") ||
        lower.includes("what was my task")
      ) {
        if (activeCommitment) {
          const dueFormatted = formatDeadline(activeCommitment.dueAt);
          answer = `You agreed to: "${activeCommitment.commitment}". Due at ${dueFormatted}.`;
        } else {
          answer = "You don't currently have an active commitment.";
        }
      } else {
        answer =
          activeDecision?.verdict
            ? `The Board chose this because: ${activeDecision.verdict}`
            : "The Board focuses on irreversible steps over endless planning.";
      }

      // Preserve current pending state
      if (session.conversationState === "AWAITING_DEADLINE") {
        return {
          reply: `${answer}\n\nYou still haven't set the deadline. When do you want this done?`,
          session
        };
      }
      if (session.conversationState === "AWAITING_COMMITMENT_CONFIRMATION") {
        return {
          reply: `${answer}\n\nDo you want to commit to this?`,
          session
        };
      }
      if (session.conversationState === "COMMITMENT_ACTIVE" || session.conversationState === "BLOCKED") {
        return {
          reply: answer,
          session
        };
      }

      return {
        reply: answer,
        session
      };
    }

    // Handle status inquiries
    if (classified.intent === "ASK_STATUS") {
      const overview = await this.getStatusOverview(userId);
      return { reply: overview, session };
    }

    // STATE: AWAITING_COMMITMENT_CONFIRMATION
    if (session.conversationState === "AWAITING_COMMITMENT_CONFIRMATION") {
      if (classified.intent === "ACCEPT_COMMITMENT") {
        const draft =
          session.pendingCommitmentDraft ||
          activeDecision?.suggestedCommitment ||
          activeDecision?.firstAction ||
          "Execute first action";

        if (classified.extractedDeadline) {
          const commitment = await this.store.createCommitment({
            userId,
            decisionId: session.activeDecisionId || "ad-hoc",
            commitment: draft,
            dueAt: classified.extractedDeadline
          });

          session.activeCommitmentId = commitment.id;
          session.conversationState = "COMMITMENT_ACTIVE";
          session.pendingCommitmentDraft = undefined;
          await this.store.saveUserSession(session);

          const timeFormatted = formatDeadline(commitment.dueAt);
          return {
            reply: `Locked.\n\n${commitment.commitment}\nDue ${timeFormatted}.\n\nI'll come back then.`,
            reaction: "👍",
            session,
            commitment
          };
        }

        session.conversationState = "AWAITING_DEADLINE";
        session.pendingCommitmentDraft = draft;
        await this.store.saveUserSession(session);

        return {
          reply: "Good. When do you want this done?",
          reaction: "👍",
          session
        };
      }

      if (classified.intent === "REJECT_COMMITMENT") {
        session.conversationState = "IDLE";
        session.pendingCommitmentDraft = undefined;
        await this.store.saveUserSession(session);
        return {
          reply: "Understood. No commitment recorded.",
          session
        };
      }

      if (classified.intent === "MODIFY_COMMITMENT") {
        session.conversationState = "DECISION_DISCUSSION";
        await this.store.saveUserSession(session);
        return {
          reply: "Understood. What do you want to adjust or commit to instead?",
          session
        };
      }
    }

    // STATE: AWAITING_DEADLINE
    if (session.conversationState === "AWAITING_DEADLINE") {
      if (classified.intent === "SET_DEADLINE") {
        if (!classified.extractedDeadline) {
          return {
            reply: classified.extractedText || "What time should I use?",
            session
          };
        }

        const draft = session.pendingCommitmentDraft || "Execute task";
        const commitment = await this.store.createCommitment({
          userId,
          decisionId: session.activeDecisionId || "ad-hoc",
          commitment: draft,
          dueAt: classified.extractedDeadline
        });

        session.activeCommitmentId = commitment.id;
        session.conversationState = "COMMITMENT_ACTIVE";
        session.pendingCommitmentDraft = undefined;
        await this.store.saveUserSession(session);

        const timeFormatted = formatDeadline(commitment.dueAt);
        return {
          reply: `Locked.\n\n${commitment.commitment}\nDue ${timeFormatted}.\n\nI'll come back then.`,
          session,
          commitment
        };
      }
    }

    // STATE: COMMITMENT_ACTIVE / BLOCKED / FOLLOW_UP_DUE / AWAITING_OUTCOME
    if (
      session.conversationState === "COMMITMENT_ACTIVE" ||
      session.conversationState === "BLOCKED" ||
      session.conversationState === "FOLLOW_UP_DUE" ||
      session.conversationState === "AWAITING_OUTCOME"
    ) {
      // 1. Task modification ("actually change the task to finish only the scheduler")
      if (classified.intent === "MODIFY_COMMITMENT" && classified.commitmentModification && activeCommitment) {
        const updated = await this.store.updateCommitmentTask(
          activeCommitment.id,
          classified.commitmentModification
        );
        return {
          reply: `Commitment updated to: "${updated.commitment}".\n\nDeadline remains ${formatDeadline(updated.dueAt)}.`,
          session,
          commitment: updated
        };
      }

      // 2. Keep deadline
      if (classified.intent === "KEEP_DEADLINE" && activeCommitment) {
        session.conversationState = "COMMITMENT_ACTIVE";
        await this.store.saveUserSession(session);
        const timeFormatted = formatDeadline(activeCommitment.dueAt);
        return {
          reply: `Keeping original deadline: ${timeFormatted}.\n\nI'll check back then.`,
          session,
          commitment: activeCommitment
        };
      }

      // 3. Reconvene the Board on the blocker
      if (classified.intent === "RECONVENE_BOARD" && activeCommitment) {
        const blockerContext = activeCommitment.blocker || "Task blocked by unexpected obstacle";
        const { board } = await this.evaluate(
          userId,
          `Our commitment "${activeCommitment.commitment}" is blocked by: ${blockerContext}. What should we do?`
        );

        session.conversationState = "BLOCKED";
        await this.store.saveUserSession(session);

        return {
          reply:
            `BOARD RECONVENED\n\n` +
            `VERDICT\n${board.verdict}\n\n` +
            `REVISED ACTION\n${board.firstAction}\n\n` +
            `Do you want to:\n1. keep the deadline\n2. move it`,
          session
        };
      }

      // 4. Move/change deadline
      if (classified.intent === "CHANGE_DEADLINE") {
        if (classified.extractedDeadline && activeCommitment) {
          const updated = await this.store.updateCommitmentDeadline(
            activeCommitment.id,
            classified.extractedDeadline
          );
          // Restore to COMMITMENT_ACTIVE and pending status
          session.conversationState = "COMMITMENT_ACTIVE";
          await this.store.saveUserSession(session);

          const timeFormatted = formatDeadline(updated.dueAt);
          return {
            reply: `Deadline moved to ${timeFormatted}.\n\nI'll check back then.`,
            session,
            commitment: updated
          };
        }
        return {
          reply: "What time do you want to move the deadline to?",
          session
        };
      }

      // 5. Completion
      if (classified.intent === "REPORT_DONE") {
        if (!activeCommitment) {
          return {
            reply: "I don't have an active commitment to close.",
            session
          };
        }

        const completed = await this.store.updateCommitmentStatus(
          activeCommitment.id,
          "completed",
          text
        );
        session.conversationState = "COMPLETED";
        session.activeCommitmentId = undefined;
        session.activeDecisionId = undefined;
        await this.store.saveUserSession(session);

        return {
          reply: `Closed.\n\nYou said you'd ship it.\nYou shipped it.\n\nI'll remember that.`,
          reaction: "👍",
          session,
          commitment: completed
        };
      }

      // 6. Blocked / partial
      if (classified.intent === "REPORT_BLOCKED") {
        if (!activeCommitment) {
          return {
            reply: "I don't have an active commitment to mark blocked.",
            session
          };
        }

        const blockerDetail = classified.blocker || classified.extractedText || text;

        session.conversationState = "BLOCKED";
        await this.store.saveUserSession(session);
        await this.store.updateCommitmentStatus(
          activeCommitment.id,
          "blocked",
          undefined,
          blockerDetail
        );

        return {
          reply: `Got it.\n\nBlocker: ${blockerDetail}.\n\nDo you want to:\n1. keep the deadline\n2. move it\n3. reconvene the Board`,
          session
        };
      }

      // 7. Abandonment -> transition to AWAITING_ABANDON_REASON
      if (classified.intent === "REPORT_ABANDONED") {
        if (!activeCommitment) {
          return {
            reply: "I don't have an active commitment to abandon.",
            session
          };
        }

        session.conversationState = "AWAITING_ABANDON_REASON";
        await this.store.saveUserSession(session);

        return {
          reply: "Understood.\n\nI'm marking this abandoned, not completed.\n\nWhy did you drop it?",
          session
        };
      }
    }

    // Guard if user says "DONE" / "BLOCKED" / "ABANDONED" when no commitment exists
    if (
      classified.intent === "REPORT_DONE" ||
      classified.intent === "REPORT_BLOCKED" ||
      classified.intent === "REPORT_ABANDONED"
    ) {
      return {
        reply: "I don't have an active commitment to close.",
        session
      };
    }

    // Default flow: treat message as new decision or dilemma
    const { decision, board } = await this.evaluate(userId, text);

    session.activeDecisionId = decision.id;
    session.conversationState = "AWAITING_COMMITMENT_CONFIRMATION";
    session.pendingCommitmentDraft =
      board.suggestedCommitment || board.firstAction;
    await this.store.saveUserSession(session);

    const seatsFormatted = board.seats
      .map((seat) => seat.replaceAll("_", " ").toUpperCase())
      .join(" · ");

    const reply =
      `BOARD\n${seatsFormatted}\n\n` +
      `CEO VERDICT\n${board.verdict}\n\n` +
      `First move:\n${board.firstAction}\n\n` +
      `I can hold you to that if you want.`;

    return {
      reply,
      session,
      decision
    };
  }
}
