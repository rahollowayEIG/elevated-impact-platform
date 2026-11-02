import React, { useEffect, useState } from "react";
import {
  beginCanvaConnection,
  getCanvaConnectionStatus,
} from "../lib/inceptionCanva.js";

// EIG-only pilot. Parent visibility and the browser flag are UX gates;
// the Edge function is responsible for actual identity and scope enforcement.
export default function CanvaConnect() {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function refresh() {
    setStatus("checking");
    setError("");
    try {
      const result = await getCanvaConnectionStatus();
      setStatus(result.connected ? "connected" : "not-connected");
    } catch (problem) {
      setStatus("unavailable");
      setError(problem.message || "Could not check the Canva connection.");
    }
  }

  useEffect(() => {
    let canceled = false;
    getCanvaConnectionStatus().then(
      (result) => { if (!canceled) setStatus(result.connected ? "connected" : "not-connected"); },
      (problem) => {
        if (!canceled) {
          setStatus("unavailable");
          setError(problem.message || "Could not check Canva.");
        }
      },
    );
    return () => { canceled = true; };
  }, []);

  async function connect() {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      // InceptionApex only uses the trusted URL returned by its secured server.
      // No session tokens or client secrets are sent to Canva by the browser.
      const url = await beginCanvaConnection();
      window.location.assign(url);
    } catch (problem) {
      setError(problem.message || "Could not begin Canva authorization.");
      setWorking(false);
    }
  }

  return (
    <section className="ia-canva-pilot" aria-label="Canva connection">
      <strong>Canva · EIG pilot</strong>
      <span role="status">
        {status === "checking"
          ? "Checking connection…"
          : status === "connected"
            ? "Connected"
            : status === "not-connected"
              ? "Not connected"
              : "Connection unavailable"}
      </span>
      <button
        type="button"
        className="platform-secondary-button"
        onClick={connect}
        disabled={working || status === "checking" || status === "unavailable"}
      >
        {working ? "Opening Canva…" : status === "connected" ? "Reconnect Canva" : "Connect Canva"}
      </button>
      <button
        type="button"
        className="platform-secondary-button"
        onClick={refresh}
        disabled={working || status === "checking"}
      >
        Refresh status
      </button>
      {error && <span className="platform-error" role="alert">{error}</span>}
      <small>Connection only. Editing, importing and exporting Canva designs are not enabled yet.</small>
    </section>
  );
}
