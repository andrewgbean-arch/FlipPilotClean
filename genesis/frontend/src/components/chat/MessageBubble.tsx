import { useState } from "react";
import type { ChatResponse } from "../../api/types";
import { formatTime, toPercent } from "../../lib/format";
import { Icon } from "../Icon";
import { Pill } from "../ui";
import { MoodBadge } from "./EmotionStrip";

export interface UiMessage {
  key: string;
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  streaming?: boolean;
  pending?: boolean;
  error?: string;
  meta?: ChatResponse;
  kind?: "greeting" | "vision" | "proactive";
  imageUrl?: string;
  visionModel?: string;
  retryText?: string;
}

function Paragraphs({ text }: { text: string }) {
  const parts = text.split(/\n{2,}/);
  return (
    <>
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

export function MessageBubble({ msg, onRetry }: { msg: UiMessage; onRetry?: (text: string) => void }) {
  const [showMemories, setShowMemories] = useState(false);
  const meta = msg.meta;
  const memories = meta?.memories_used ?? [];
  const tools = meta?.tool_calls ?? [];
  const isUser = msg.role === "user";

  return (
    <article className={`msg msg-${msg.role}${msg.kind ? ` msg-${msg.kind}` : ""}${msg.error ? " msg-failed" : ""}`}>
      <div className="msg-bubble">
        <span className="sr-only">{isUser ? "You said:" : "Genesis said:"}</span>
        {msg.imageUrl && <img className="msg-image" src={msg.imageUrl} alt="Image you shared" />}
        {msg.kind === "vision" && !msg.streaming && (
          <p className="msg-kind">
            <Icon name="image" size={13} /> Image description{msg.visionModel ? ` · ${msg.visionModel}` : ""}
          </p>
        )}
        {msg.content ? (
          <Paragraphs text={msg.content} />
        ) : msg.streaming ? (
          <span className="typing" aria-label="Genesis is thinking">
            <span />
            <span />
            <span />
          </span>
        ) : null}
        {msg.streaming && msg.content && <span className="caret" aria-hidden="true" />}
      </div>

      {msg.error && (
        <div className="msg-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{msg.error}</span>
          {msg.retryText && onRetry && (
            <button type="button" className="btn btn-small" onClick={() => onRetry(msg.retryText!)}>
              <Icon name="refresh" size={13} /> Retry
            </button>
          )}
        </div>
      )}

      {(meta || msg.created_at) && !msg.streaming && (
        <div className="msg-foot">
          {msg.created_at && <time className="msg-time">{formatTime(msg.created_at)}</time>}
          {meta?.mood && <MoodBadge mood={meta.mood} small />}
          {memories.length > 0 && (
            <button
              type="button"
              className="chip-toggle"
              aria-expanded={showMemories}
              onClick={() => setShowMemories((s) => !s)}
            >
              <Icon name="memory" size={13} />
              {memories.length} {memories.length === 1 ? "memory" : "memories"} used
              <Icon name={showMemories ? "chevronDown" : "chevronRight"} size={12} />
            </button>
          )}
          {meta?.safety_flags?.map((f) => (
            <Pill key={f} tone="warning" title="Safety flag raised for this message">
              {f.replace(/_/g, " ")}
            </Pill>
          ))}
        </div>
      )}

      {showMemories && memories.length > 0 && (
        <ul className="memory-chips" aria-label="Memories used for this reply">
          {memories.map((m) => (
            <li key={m.id} className="memory-chip" title={`Relevance ${Math.round(toPercent(m.score, 1))}%`}>
              <span>{m.title}</span>
              <span className="memory-chip-score">{Math.round(toPercent(m.score, 1))}%</span>
            </li>
          ))}
        </ul>
      )}

      {tools.length > 0 && !msg.streaming && (
        <div className="tool-calls">
          {tools.map((t, i) => (
            <details key={i} className="tool-call">
              <summary>
                <Icon name="tool" size={13} /> {t.name}
                <span className={t.ok ? "status status-good" : "status status-critical"}>
                  <Icon name={t.ok ? "check" : "x"} size={12} strokeWidth={2.4} />
                  {t.ok ? "ok" : "failed"}
                </span>
              </summary>
              <div className="tool-call-body">
                <p className="label">Arguments</p>
                <pre>{JSON.stringify(t.arguments, null, 2)}</pre>
                <p className="label">Result</p>
                <pre>{t.result}</pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </article>
  );
}
