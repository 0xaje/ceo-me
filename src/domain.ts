export type BoardSeat =
  | "future_you"
  | "cfo"
  | "operator"
  | "creative"
  | "chaos_intern";

export type CommitmentStatus =
  | "pending"
  | "completed"
  | "blocked"
  | "abandoned";

export type DecisionRecord = {
  id: string;
  userId: string;
  input: string;
  seats: BoardSeat[];
  verdict: string;
  firstAction: string;
  createdAt: string;
};

export type CommitmentRecord = {
  id: string;
  decisionId: string;
  userId: string;
  commitment: string;
  dueAt: string;
  status: CommitmentStatus;
  createdAt: string;
  updatedAt: string;
  outcomeNote?: string;
};

export type BoardVerdict = {
  seats: BoardSeat[];
  verdict: string;
  firstAction: string;
  suggestedCommitment?: string;
};
