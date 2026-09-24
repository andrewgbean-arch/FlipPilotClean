import { useCallback, useEffect, useState } from "react";
import { API_BASE, api, useConnection, type Health } from "../api";
import { modelProblems } from "../lib/health";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

const RETRY_SECONDS = 5;

/**
 * Global banner: explains when the backend is unreachable (and keeps retrying),
 * or when it is responding slowly. Probes /health on start so the app knows early.
 */
export function ConnectionBanner() {
  const conn = useConnection();
  const [countdown, setCountdown] = useState(RETRY_SECONDS);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<Health | undefined>(undefined);
  const [modelsDismissed, setModelsDismissed] = useState(false);

  const probe = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await api.health());
    } catch {
      /* status is tracked by the client */
    } finally {
      setChecking(false);
      setCountdown(RETRY_SECONDS);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    if (conn.status !== "offline") return;
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          void probe();
          return RETRY_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [conn.status, probe]);

  const problems = modelProblems(health);
  // While a model is missing, re-check every minute so the hint clears after `ollama pull`.
  useEffect(() => {
    if (problems.length === 0 || conn.status === "offline") return;
    const id = window.setInterval(() => void probe(), 60000);
    return () => window.clearInterval(id);
  }, [problems.length, conn.status, probe]);

  if (conn.status === "offline") {
    return (
      <div className="banner banner-offline" role="alert">
        <Icon name="offline" />
        <div className="banner-text">
          <strong>Can't reach Genesis.</strong>{" "}
          <span>
            The backend at <code>{API_BASE}</code> isn't responding. Make sure it is running (
            <code>uvicorn genesis.main:app</code>).
          </span>
        </div>
        <div className="banner-actions">
          <span className="muted" aria-live="off">
            {checking ? "Checking…" : `Retrying in ${countdown}s`}
          </span>
          <button type="button" className="btn btn-small" onClick={() => void probe()} disabled={checking}>
            {checking ? <Spinner size={12} label="Checking" /> : <Icon name="refresh" size={14} />} Retry now
          </button>
        </div>
      </div>
    );
  }
  if (problems.length > 0 && !modelsDismissed) {
    return (
      <div className="banner banner-warning" role="status">
        <Icon name="alert" />
        <div className="banner-text">
          {problems.map((p) => (
            <p key={p.text}>
              <strong>{p.text}</strong>{" "}
              {p.command && <code>{p.command}</code>}
            </p>
          ))}
        </div>
        <div className="banner-actions">
          <button type="button" className="btn btn-small" onClick={() => void probe()} disabled={checking}>
            {checking ? <Spinner size={12} label="Checking" /> : <Icon name="refresh" size={14} />} Check again
          </button>
          <button type="button" className="icon-btn" aria-label="Dismiss model warning" onClick={() => setModelsDismissed(true)}>
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>
    );
  }
  if (conn.slow > 0) {
    return (
      <div className="banner banner-slow" role="status">
        <Spinner size={14} label="Waiting" />
        <div className="banner-text">Genesis is taking a while to respond. Hang tight…</div>
      </div>
    );
  }
  return null;
}
