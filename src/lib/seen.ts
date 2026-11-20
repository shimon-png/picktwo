"use client";

/**
 * Battles this browser already voted on or skipped. The server feed excludes them too; this guards against
 * the client router cache replaying an old feed when you come back to the Vote tab.
 */
const KEY = "cp_done_v1";
const MAX = 500;

export function doneIds(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

export function markDone(id: string) {
  try {
    const ids = [...doneIds()].filter((x) => x !== id);
    ids.push(id);
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX)));
  } catch {}
}

export function unmarkDone(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...doneIds()].filter((x) => x !== id)));
  } catch {}
}
