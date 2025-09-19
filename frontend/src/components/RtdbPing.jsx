import { useEffect, useState } from "react";
import { rtdbSet, rtdbGet, rtdbSubscribe } from "../lib/rtdb";

export default function RtdbPing() {
  const [value, setValue] = useState(null);

  useEffect(() => {
    // subscribe to realtime changes
    const unsub = rtdbSubscribe("/debug/ping", setValue);
    return () => unsub();
  }, []);

  async function writeNow() {
    const now = new Date().toISOString();
    await rtdbSet("/debug/ping", { updatedAt: now, message: "Hello RTDB 👋" });
    const once = await rtdbGet("/debug/ping");
    console.log("Read after write:", once);
  }

  return (
    <div className="card card-body">
      <div className="mb-2">/debug/ping → {value ? JSON.stringify(value) : "(no data)"}</div>
      <button className="btn btn-primary" onClick={writeNow}>Write & Read</button>
    </div>
  );
}
