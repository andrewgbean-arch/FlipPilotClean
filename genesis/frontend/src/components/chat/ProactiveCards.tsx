import type { ProactiveMessage } from "../../api/types";
import { humanize, timeAgo } from "../../lib/format";
import { Icon } from "../Icon";

export function ProactiveCards({
  items,
  onDismiss,
  onReply,
}: {
  items: ProactiveMessage[];
  onDismiss: (id: number) => void;
  onReply: (msg: ProactiveMessage) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="proactive" aria-label="Messages from Genesis while you were away">
      {items.map((p) => (
        <div key={p.id} className="proactive-card">
          <Icon name="sparkle" size={16} className="proactive-icon" />
          <div className="proactive-body">
            <p className="proactive-kind">
              {humanize(p.kind || "note")} · {timeAgo(p.created_at)}
            </p>
            <p>{p.content}</p>
          </div>
          <div className="proactive-actions">
            <button type="button" className="btn btn-small btn-ghost" onClick={() => onReply(p)}>
              Reply
            </button>
            <button type="button" className="icon-btn" onClick={() => onDismiss(p.id)} aria-label="Dismiss message">
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
