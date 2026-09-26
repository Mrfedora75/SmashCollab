export type InboundPitch = {
  creatorId: string;
  ago: string;
  message: string;
  title: string;
};

export type AcceptedCollab = {
  id: string;
  creatorId: string;
  title: string;
  when: string;
  summary: string;
  /** uid of whoever blocked this match, if anyone. */
  blockedBy?: string | null;
};

export type ChatMessage = {
  id: string;
  from: "them" | "you";
  text: string;
};

export type BlockedCreator = {
  creatorId: string;
  channel: string;
  collab: AcceptedCollab;
  messages: ChatMessage[];
};
