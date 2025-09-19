// src/lib/rtdb.js
import { rtdb } from "../firebaseClient";
import {
  ref,
  set,
  get,
  onValue,
  off,
  push,
  update,
  remove,
  child,
} from "firebase/database";

/** Normalize leading/trailing/double slashes */
function norm(path) {
  if (!path) return "/";
  let p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/{2,}/g, "/");
}

/* ------------------ Generic helpers (used across app) ------------------ */

/** Write (PUT) a value at `path` */
export function rtdbSet(path, value) {
  return set(ref(rtdb, norm(path)), value ?? null);
}

/** Read once from `path` → returns value or null */
export async function rtdbGet(path) {
  const snap = await get(ref(rtdb, norm(path)));
  return snap.exists() ? snap.val() : null;
}

/** Subscribe to changes at `path`; returns unsubscribe fn */
export function rtdbSubscribe(path, cb) {
  const r = ref(rtdb, norm(path));
  const handler = (snap) => cb(snap.exists() ? snap.val() : null);
  onValue(r, handler);
  return () => off(r, "value", handler);
}

/** Push under a collection (auto-id). Returns the new key */
export async function rtdbPush(collectionPath, value) {
  const parent = ref(rtdb, norm(collectionPath));
  const newRef = push(parent);
  await set(newRef, value ?? null);
  return newRef.key;
}

/** Partial update at `path` (merge-like) */
export function rtdbUpdate(path, partial) {
  return update(ref(rtdb, norm(path)), partial || {});
}

/** Delete node at `path` */
export function rtdbRemove(path) {
  return remove(ref(rtdb, norm(path)));
}

/** Read a child by key under a base path */
export async function rtdbGetChild(base, key) {
  const snap = await get(child(ref(rtdb, norm(base)), key));
  return snap.exists() ? snap.val() : null;
}

/* ------------------ Logo-specific helpers (Teams & Tournaments) ------------------ */

/** Teams logos live under /logos/{key} */
export async function saveLogoToRTDB(logoObj) {
  return rtdbPush("/logos", logoObj);
}
export async function readLogoFromRTDB(key) {
  return rtdbGetChild("/logos", key);
}

/** Tournament logos live under /tournamentLogos/{key} */
export async function saveTournamentLogo(logoObj) {
  return rtdbPush("/tournamentLogos", logoObj);
}
export async function readTournamentLogo(key) {
  return rtdbGetChild("/tournamentLogos", key);
}
