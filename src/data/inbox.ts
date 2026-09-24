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

export const INBOUND_PITCHES: InboundPitch[] = [
  {
    creatorId: "jules",
    ago: "2h",
    message: "Could we tear down a weeknight setup? Your pasta film is the calm version of my bench.",
    title: "Weeknight teardown",
  },
  {
    creatorId: "priya",
    ago: "Yesterday",
    message: "A money episode in your kitchen. One grocery run, one honest receipt.",
    title: "Kitchen receipt",
  },
  {
    creatorId: "hana",
    ago: "3d",
    message: "Still Life wants a get-ready filmed at your table, not a vanity.",
    title: "Table get-ready",
  },
];

export const ACCEPTED_COLLABS: AcceptedCollab[] = [
  {
    id: "reed-shelf",
    creatorId: "reed",
    title: "One-sheet bookshelf",
    when: "Wrapped in August",
    summary: "You cooked between cuts. Reed filmed the build.",
  },
  {
    id: "cam-market",
    creatorId: "cam",
    title: "Oaxaca market cook",
    when: "Wrapped in July",
    summary: "Two market mornings and one shared dinner.",
  },
];

export const THREADS: Record<string, ChatMessage[]> = {
  "reed-shelf": [
    { id: "reed-1", from: "them", text: "The shelf is dry. Want to film the load-in Tuesday?" },
    { id: "reed-2", from: "you", text: "Tuesday works. I'll bring the pasta for the cutaways." },
    { id: "reed-3", from: "them", text: "Leave the saws to me. I'll send the shot list tonight." },
  ],
  "cam-market": [
    { id: "cam-1", from: "them", text: "Market opens at 7. I'll be at the mole stall." },
    { id: "cam-2", from: "you", text: "I'll meet you there. One shared dinner video, two angles." },
    { id: "cam-3", from: "them", text: "Bring the small pan. The stall owner said we can cook on the side." },
  ],
};
