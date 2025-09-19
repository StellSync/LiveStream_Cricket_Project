// src/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

// Your config (from your message)
const firebaseConfig = {
  apiKey: "AIzaSyCekcCJ47fwTWbKW1Sg4OQib7HfI51CuNw",
  authDomain: "cricketlogostorage.firebaseapp.com",
  databaseURL: "https://cricketlogostorage-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cricketlogostorage",
  storageBucket: "cricketlogostorage.firebasestorage.app",
  messagingSenderId: "920587212776",
  appId: "1:920587212776:web:3f783c8cbc6a7aab00365d",
  measurementId: "G-8MN49ZW2ML"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

// Optional analytics (browser-only)
export let analytics = null;
(async () => {
  if (typeof window !== "undefined" && (await analyticsSupported())) {
    analytics = getAnalytics(app);
  }
})();
