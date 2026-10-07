import type { BoardSeat, BoardVerdict } from "./domain.js";

export function selectBoard(input: string): BoardSeat[] {
  const text = input.toLowerCase();

  if (/money|price|buy|cost|revenue|salary|budget|spend|invest|fund/.test(text)) {
    return ["cfo", "operator", "future_you"];
  }

  if (/post|content|design|creative|brand|video|launch|marketing|copy/.test(text)) {
    return ["creative", "operator", "future_you"];
  }

  if (/crazy|wild|radical|throwaway|disrupt|blow it up/.test(text)) {
    return ["chaos_intern", "operator", "future_you"];
  }

  return ["operator", "future_you"];
}

export function createDeterministicVerdict(input: string): BoardVerdict {
  const seats = selectBoard(input);
  const text = input.toLowerCase();

  if (/dashboard|calendar integration|email integration|more features|add features|expand/.test(text)) {
    return {
      seats,
      verdict: "Stop expanding scope. Ship the complete decision → commitment → follow-up loop first.",
      firstAction: "Get one complete decision → commitment → follow-up flow working.",
      suggestedCommitment: "Finish the real iMessage commitment flow"
    };
  }

  if (/commit|flow|photon|imessage|ceo-002/.test(text)) {
    return {
      seats,
      verdict: "Lock in the core conversational path. Prove proactive follow-up works end-to-end.",
      firstAction: "Ship the real iMessage commitment flow.",
      suggestedCommitment: "Ship the real iMessage commitment flow"
    };
  }

  return {
    seats,
    verdict: "Reduce this to one decision and act on the smallest irreversible next step.",
    firstAction: "Write the single outcome you want, then take one concrete action toward it.",
    suggestedCommitment: "Execute the single smallest next step today"
  };
}
