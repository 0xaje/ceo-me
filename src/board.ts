import type { BoardSeat, BoardVerdict } from "./domain.js";

export function selectBoard(input: string): BoardSeat[] {
  const text = input.toLowerCase();

  if (/money|price|buy|cost|revenue|salary|budget|spend/.test(text)) {
    return ["cfo", "operator", "future_you"];
  }

  if (/post|content|design|creative|brand|video|launch/.test(text)) {
    return ["creative", "operator", "future_you"];
  }

  return ["operator", "future_you"];
}

export function createDeterministicVerdict(input: string): BoardVerdict {
  const seats = selectBoard(input);
  const text = input.toLowerCase();

  if (/dashboard|calendar integration|email integration|more features|add features/.test(text)) {
    return {
      seats,
      verdict: "Stop expanding scope. Prove the core decision-to-follow-up loop first.",
      firstAction: "Get one complete decision → commitment → follow-up flow working.",
      suggestedCommitment: "Ship the complete CEO-001 loop."
    };
  }

  return {
    seats,
    verdict: "Reduce this to one decision and act on the smallest irreversible next step.",
    firstAction: "Write the single outcome you want, then take one concrete action toward it."
  };
}
