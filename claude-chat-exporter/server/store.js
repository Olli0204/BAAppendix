import { randomUUID } from "node:crypto";

// In-Memory-Sessions für Chunk-Exporte langer Chats (begin → append → finalize).
const sessions = new Map();
const TTL_MS = 30 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.touched > TTL_MS) sessions.delete(id);
  }
}

export function createSession({ title, format, date }) {
  sweep();
  const id = randomUUID().slice(0, 8);
  sessions.set(id, { title, format, date, messages: [], touched: Date.now() });
  return id;
}

export function getSession(id) {
  sweep();
  const s = sessions.get(id);
  if (s) s.touched = Date.now();
  return s || null;
}

export function deleteSession(id) {
  sessions.delete(id);
}
