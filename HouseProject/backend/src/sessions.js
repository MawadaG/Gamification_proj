import crypto from "crypto";

const sessions = new Map(); // token -> userId

export function createSession(userId) {
  const token = crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex");
  sessions.set(token, userId);
  return token;
}

export function getUserIdFromToken(token) {
  if (!token) return null;
  return sessions.get(token) || null;
}

export function deleteSession(token) {
  if (!token) return;
  sessions.delete(token);
}
