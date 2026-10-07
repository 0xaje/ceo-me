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

export type ConversationState =
  | "IDLE"
  | "DECISION_DISCUSSION"
  | "AWAITING_COMMITMENT_CONFIRMATION"
  | "AWAITING_DEADLINE"
  | "COMMITMENT_ACTIVE"
  | "FOLLOW_UP_DUE"
  | "AWAITING_OUTCOME"
  | "BLOCKED"
  | "AWAITING_ABANDON_REASON"
  | "COMPLETED"
  | "ABANDONED";

export type UserIntent =
  | "NEW_DECISION"
  | "ASK_EXPLANATION"
  | "ACCEPT_COMMITMENT"
  | "REJECT_COMMITMENT"
  | "MODIFY_COMMITMENT"
  | "SET_DEADLINE"
  | "CHANGE_DEADLINE"
  | "KEEP_DEADLINE"
  | "RECONVENE_BOARD"
  | "REPORT_DONE"
  | "REPORT_BLOCKED"
  | "REPORT_ABANDONED"
  | "ASK_STATUS"
  | "SMALL_TALK"
  | "UNKNOWN";

export type DecisionRecord = {
  id: string;
  userId: string;
  input: string;
  seats: BoardSeat[];
  verdict: string;
  firstAction: string;
  suggestedCommitment?: string;
  createdAt: string;
};

export type CommitmentRecord = {
  id: string;
  decisionId: string;
  userId: string;
  commitment: string;
  dueAt: string;
  status: CommitmentStatus;
  blocker?: string;
  createdAt: string;
  updatedAt: string;
  outcomeNote?: string;
  followUpSentAt?: string;
  followUpError?: string;
};

export type UserRouting = {
  spaceId: string;
  platform: string;
  phone?: string;
  updatedAt: string;
};

export type UserSessionRecord = {
  userId: string;
  activeDecisionId?: string;
  activeCommitmentId?: string;
  conversationState: ConversationState;
  lastIntent?: UserIntent;
  pendingCommitmentDraft?: string;
  routing?: UserRouting;
  updatedAt: string;
};

export type BoardVerdict = {
  seats: BoardSeat[];
  verdict: string;
  firstAction: string;
  suggestedCommitment?: string;
  perspectives?: { seat: BoardSeat; opinion: string }[];
};
