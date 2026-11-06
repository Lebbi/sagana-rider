export interface ChatMessage {
  /** Server id, or a negative temp id while an optimistic send is in flight. */
  id: number;
  senderId: number;
  body: string;
  createdAt: string;
  pending?: boolean;
}

/** Merges by id (incoming wins), real messages in id order, pending ones after them. */
export function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  const all = [...byId.values()];
  const real = all.filter((m) => m.id > 0).sort((a, b) => a.id - b.id);
  const pending = all.filter((m) => m.id <= 0);
  return [...real, ...pending];
}

/** Highest real message id held, for `after_id`. Undefined when none yet. */
export function latestMessageId(messages: ChatMessage[]): number | undefined {
  const ids = messages.filter((m) => m.id > 0).map((m) => m.id);
  return ids.length ? Math.max(...ids) : undefined;
}
