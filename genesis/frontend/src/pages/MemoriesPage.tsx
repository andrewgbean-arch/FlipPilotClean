import { useEffect, useState, type FormEvent } from "react";
import {
  IMPORTANCE_LEVELS,
  MEMORY_CATEGORIES,
  MEMORY_TYPES,
  api,
  errorMessage,
  type Importance,
  type Memory,
  type MemoryType,
} from "../api";
import { Icon } from "../components/Icon";
import { ConfirmButton, EmptyState, ErrorState, Field, ImportancePill, Loading, Modal, PageHeader, Spinner, Toast } from "../components/ui";
import { formatDateTime, humanize, pct, timeAgo, toPercent } from "../lib/format";

const PAGE = 50;

interface Row {
  memory: Memory;
  score?: number;
}

export default function MemoriesPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [memoryType, setMemoryType] = useState<MemoryType | "">("");
  const [importance, setImportance] = useState<Importance | "">("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<Row[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const searching = submittedQuery.trim().length > 0;

  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        if (searching) {
          const res = await api.searchMemories(
            { query: submittedQuery.trim(), limit: PAGE, memory_types: memoryType ? [memoryType] : undefined },
            c.signal,
          );
          let r: Row[] = res.map((x) => ({ memory: x.memory, score: x.score }));
          if (importance) r = r.filter((x) => x.memory.importance === importance);
          if (!includeArchived) r = r.filter((x) => !x.memory.archived);
          setRows(r);
          setHasMore(false);
        } else {
          const res = await api.memories({ memory_type: memoryType, importance, include_archived: includeArchived, limit: PAGE, offset: 0 }, c.signal);
          setRows(res.map((m) => ({ memory: m })));
          setHasMore(res.length === PAGE);
        }
      } catch (err) {
        if (!c.signal.aborted) setError(errorMessage(err));
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => c.abort();
  }, [submittedQuery, searching, memoryType, importance, includeArchived, reloadTick]);

  const loadMore = async () => {
    if (!rows) return;
    setLoadingMore(true);
    try {
      const res = await api.memories({ memory_type: memoryType, importance, include_archived: includeArchived, limit: PAGE, offset: rows.length });
      setRows([...rows, ...res.map((m) => ({ memory: m }))]);
      setHasMore(res.length === PAGE);
    } catch (err) {
      setToast(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(query);
  };

  const replace = (m: Memory) => {
    setRows((prev) => prev?.map((r) => (r.memory.id === m.id ? { ...r, memory: m } : r)));
    setSelected(m);
  };
  const remove = (id: number) => {
    setRows((prev) => prev?.filter((r) => r.memory.id !== id));
    setSelected(null);
    setToast("Memory deleted.");
  };

  return (
    <div className="page">
      <PageHeader
        title="Memories"
        subtitle="Everything Genesis remembers about your life together. Search by meaning, then review, correct or forget."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Add memory
          </button>
        }
      />

      <form className="filters" onSubmit={onSearch} role="search">
        <div className="search-box">
          <Icon name="search" size={16} />
          <label htmlFor="mem-q" className="sr-only">
            Search memories
          </label>
          <input
            id="mem-q"
            type="search"
            placeholder="Search memories by meaning…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setSubmittedQuery("");
            }}
          />
          <button type="submit" className="btn btn-small">
            Search
          </button>
        </div>
        <label className="inline-label">
          <span>Type</span>
          <select value={memoryType} onChange={(e) => setMemoryType(e.target.value as MemoryType | "")}>
            <option value="">All types</option>
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-label">
          <span>Importance</span>
          <select value={importance} onChange={(e) => setImportance(e.target.value as Importance | "")}>
            <option value="">Any</option>
            {IMPORTANCE_LEVELS.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Include archived
        </label>
      </form>

      {searching && (
        <p className="muted small results-note">
          Showing the closest matches for “{submittedQuery}”.{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setQuery("");
              setSubmittedQuery("");
            }}
          >
            Clear search
          </button>
        </p>
      )}

      {error && <ErrorState error={error} onRetry={() => setReloadTick((t) => t + 1)} />}
      {loading && !rows ? (
        <Loading rows={6} />
      ) : rows && rows.length === 0 && !error ? (
        <EmptyState icon="memory" title={searching ? "No memories match that search." : "No memories here yet."}>
          {!searching && <p>Memories form naturally as you chat. You can also add one yourself.</p>}
        </EmptyState>
      ) : (
        rows && (
          <ul className={loading ? "memory-list is-refreshing" : "memory-list"} aria-busy={loading}>
            {rows.map(({ memory: m, score }) => (
              <li key={m.id}>
                <button type="button" className="memory-card" onClick={() => setSelected(m)}>
                  <div className="memory-card-head">
                    <span className="memory-title">{m.title || "Untitled memory"}</span>
                    <ImportancePill importance={m.importance} />
                  </div>
                  <p className="memory-content">{m.content}</p>
                  <div className="memory-meta">
                    <span>{humanize(m.memory_type)}</span>
                    <span>{humanize(m.category)}</span>
                    <span title="Confidence">conf {pct(m.confidence, 1)}</span>
                    <span title="Times recalled">recalled {m.retrieval_count}×</span>
                    {score !== undefined && <span title="Search relevance">match {Math.round(toPercent(score, 1))}%</span>}
                    {m.archived && <span className="pill pill-neutral">archived</span>}
                    <span className="muted">{timeAgo(m.created_at)}</span>
                  </div>
                  {m.tags.length > 0 && (
                    <div className="tags">
                      {m.tags.map((t) => (
                        <span key={t} className="tag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {hasMore && !searching && (
        <div className="center">
          <button type="button" className="btn" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? <Spinner size={14} /> : null} Load more
          </button>
        </div>
      )}

      <MemoryDetail memory={selected} onClose={() => setSelected(null)} onSaved={replace} onDeleted={remove} />
      <AddMemory
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(m) => {
          setRows((prev) => [{ memory: m }, ...(prev ?? [])]);
          setAdding(false);
          setToast("Memory saved.");
        }}
      />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function MemoryDetail({
  memory,
  onClose,
  onSaved,
  onDeleted,
}: {
  memory: Memory | null;
  onClose: () => void;
  onSaved: (m: Memory) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Memory | null>(memory);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(memory);
    setTagsText(memory?.tags.join(", ") ?? "");
    setEditing(false);
    setErr(null);
  }, [memory]);

  if (!memory || !draft) return <Modal open={false} title="" onClose={onClose}>{null}</Modal>;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateMemory({
        memory_id: memory.id,
        title: draft.title,
        content: draft.content,
        importance: draft.importance,
        confidence: draft.confidence,
        memory_type: draft.memory_type,
        category: draft.category,
        archived: draft.archived,
        tags: tagsText
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean),
      });
      onSaved(updated);
      setEditing(false);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    setSaving(true);
    setErr(null);
    try {
      await api.deleteMemory(memory.id);
      onDeleted(memory.id);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  const footer = editing ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !draft.content.trim()}>
        {saving ? <Spinner size={14} /> : <Icon name="check" size={15} />} Save changes
      </button>
    </>
  ) : (
    <>
      <ConfirmButton onConfirm={() => void del()} className="btn btn-danger" confirmLabel="Really forget?" ariaLabel="Delete memory" disabled={saving}>
        <Icon name="trash" size={15} /> Forget
      </ConfirmButton>
      <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
        <Icon name="edit" size={15} /> Edit
      </button>
    </>
  );

  return (
    <Modal open title={editing ? "Edit memory" : memory.title || "Memory"} onClose={onClose} footer={footer} wide>
      {err && <ErrorState compact error={err} />}
      {editing ? (
        <div className="form-grid">
          <Field label="Title">{(id) => <input id={id} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
          <Field label="Content">
            {(id) => <textarea id={id} rows={5} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />}
          </Field>
          <div className="form-row">
            <Field label="Type">
              {(id) => (
                <select id={id} value={draft.memory_type} onChange={(e) => setDraft({ ...draft, memory_type: e.target.value as MemoryType })}>
                  {MEMORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Category">
              {(id) => (
                <select id={id} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {[...new Set([...MEMORY_CATEGORIES, draft.category])].map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Importance">
              {(id) => (
                <select id={id} value={draft.importance} onChange={(e) => setDraft({ ...draft, importance: e.target.value as Importance })}>
                  {IMPORTANCE_LEVELS.map((t) => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label={`Confidence (${pct(draft.confidence, 1)})`}>
            {(id) => (
              <input
                id={id}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.confidence}
                onChange={(e) => setDraft({ ...draft, confidence: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Tags" hint="Comma separated">
            {(id) => <input id={id} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />}
          </Field>
          <label className="inline-check">
            <input type="checkbox" checked={draft.archived} onChange={(e) => setDraft({ ...draft, archived: e.target.checked })} />
            Archived (kept, but no longer recalled)
          </label>
        </div>
      ) : (
        <div className="memory-detail">
          <p className="memory-detail-content">{memory.content}</p>
          <div className="tags">
            <ImportancePill importance={memory.importance} />
            {memory.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
          <dl className="kv two-col">
            <dt>Type</dt>
            <dd>{humanize(memory.memory_type)}</dd>
            <dt>Category</dt>
            <dd>{humanize(memory.category)}</dd>
            <dt>Tier</dt>
            <dd>{memory.tier}-term</dd>
            <dt>Importance score</dt>
            <dd>{pct(memory.importance_score, 1)}</dd>
            <dt>Confidence</dt>
            <dd>{pct(memory.confidence, 1)}</dd>
            <dt>Emotional tone</dt>
            <dd>
              {memory.emotional_score > 0.15 ? "joyful" : memory.emotional_score < -0.15 ? "painful" : "neutral"} ({memory.emotional_score.toFixed(2)})
            </dd>
            <dt>Source</dt>
            <dd>{memory.source}</dd>
            <dt>Recalled</dt>
            <dd>
              {memory.retrieval_count}× · last {timeAgo(memory.last_recalled)}
            </dd>
            <dt>Indexed</dt>
            <dd>{memory.indexed ? "yes (searchable by meaning)" : "not yet"}</dd>
            <dt>Archived</dt>
            <dd>{memory.archived ? "yes" : "no"}</dd>
            <dt>Created</dt>
            <dd>{formatDateTime(memory.created_at)}</dd>
            <dt>Updated</dt>
            <dd>{formatDateTime(memory.updated_at)}</dd>
            {memory.related_memory_ids.length > 0 && (
              <>
                <dt>Related</dt>
                <dd>{memory.related_memory_ids.map((id) => `#${id}`).join(", ")}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </Modal>
  );
}

function AddMemory({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (m: Memory) => void }) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [memoryType, setMemoryType] = useState<MemoryType>("semantic");
  const [category, setCategory] = useState("personal");
  const [importance, setImportance] = useState<Importance>("medium");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const m = await api.addMemory({
        content: content.trim(),
        title: title.trim() || undefined,
        memory_type: memoryType,
        category,
        importance,
        confidence: 1,
        tags: tags
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean),
      });
      onAdded(m);
      setContent("");
      setTitle("");
      setTags("");
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add a memory"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving || !content.trim()}>
            {saving ? <Spinner size={14} /> : <Icon name="plus" size={15} />} Save memory
          </button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        {err && <ErrorState compact error={err} />}
        <Field label="What should Genesis remember?">
          {(id) => <textarea id={id} rows={4} value={content} onChange={(e) => setContent(e.target.value)} required autoFocus />}
        </Field>
        <Field label="Title (optional)">{(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <div className="form-row">
          <Field label="Type">
            {(id) => (
              <select id={id} value={memoryType} onChange={(e) => setMemoryType(e.target.value as MemoryType)}>
                {MEMORY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Category">
            {(id) => (
              <select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Importance">
            {(id) => (
              <select id={id} value={importance} onChange={(e) => setImportance(e.target.value as Importance)}>
                {IMPORTANCE_LEVELS.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Tags" hint="Comma separated">
          {(id) => <input id={id} value={tags} onChange={(e) => setTags(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
