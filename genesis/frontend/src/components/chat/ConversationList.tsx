import type { ConversationSummary } from "../../api/types";
import { timeAgo } from "../../lib/format";
import { Icon } from "../Icon";
import { ConfirmButton, ErrorState, Loading } from "../ui";

interface Props {
  conversations: ConversationSummary[] | undefined;
  loading: boolean;
  error: string | null;
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onRetry: () => void;
}

export function ConversationList({ conversations, loading, error, activeId, onSelect, onNew, onDelete, onRetry }: Props) {
  return (
    <div className="conv-list">
      <div className="conv-list-head">
        <h2 className="conv-list-title">Conversations</h2>
        <button type="button" className="btn btn-primary btn-small" onClick={onNew}>
          <Icon name="plus" size={14} /> New
        </button>
      </div>
      {conversations === undefined ? (
        error ? (
          <ErrorState compact error={error} onRetry={onRetry} />
        ) : loading ? (
          <Loading rows={4} />
        ) : null
      ) : conversations.length === 0 ? (
        <p className="muted conv-empty">No conversations yet. Say hello!</p>
      ) : (
        <ul className="conv-items">
          {conversations.map((c) => (
            <li key={c.id} className={c.id === activeId ? "conv-item active" : "conv-item"}>
              <button
                type="button"
                className="conv-select"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === activeId ? "page" : undefined}
                title={c.summary || c.title}
              >
                <span className="conv-title">{c.title || `Conversation ${c.id}`}</span>
                <span className="conv-meta">
                  {timeAgo(c.last_message_at || c.started_at)} · {c.message_count} msg
                </span>
              </button>
              <ConfirmButton
                className="icon-btn conv-delete"
                confirmLabel="Delete?"
                ariaLabel={`Delete conversation ${c.title || c.id}`}
                onConfirm={() => onDelete(c.id)}
              >
                <Icon name="trash" size={15} />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
