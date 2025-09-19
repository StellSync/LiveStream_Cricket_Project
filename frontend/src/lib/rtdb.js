// src/lib/rtdb.js
import { rtdb } from "../firebaseClient";
import { ref, push, set, get, child } from "firebase/database";

/** Save a logo object under /logos (returns generated key) */
export async function saveLogoToRTDB(logoObj) {
  const logosRef = ref(rtdb, "/logos");
  const newRef = push(logosRef);
  await set(newRef, logoObj);
  return newRef.key;
}

/** Read a logo by key (returns object or null) */
export async function readLogoFromRTDB(key) {
  const snap = await get(child(ref(rtdb), `/logos/${key}`));
  return snap.exists() ? snap.val() : null;
}
