import { useMemo, useState, type FormEvent } from "react";
import { api, errorMessage, type JournalEntry, type JournalPeriod, type TimelineEvent } from "../api";
import { Icon } from "../components/Icon";
import { AsyncBlock, Card, EmptyState, ErrorState, Field, PageHeader, Spinner } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDate, formatDateTime, humanize, parseDate, timeAgo } from "../lib/format";

const PERIODS: JournalPeriod[] = ["daily", "weekly", "monthly"];

export default function JournalPage() {
  return (
    <div className="page">
      <PageHeader title="Journal & timeline" subtitle="Genesis's diary of your time together, the moments that mattered, and what it has been thinking about." />
      <div className="grid journal-grid">
        <JournalSection />
        <TimelineSection />
        <ReflectionsSection />
      </div>
    </div>
  );
}

function JournalSection() {
  const [period, setPeriod] = useState<JournalPeriod | "all">("all");
  const journal = useApi((s) => api.journal(period === "all" ? undefined : period, s), [period]);
  const [genPeriod, setGenPeriod] = useState<JournalPeriod>("daily");
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setErr(null);
    try {
      const entry = await api.generateJournal(genPeriod);
      journal.setData((prev) => [entry, ...(prev ?? []).filter((e) => e.id !== entry.id)]);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setGenerating(false);
    }
  };

  const groups = useMemo(() => {
    const list = journal.data ?? [];
    return PERIODS.map((p) => ({
      period: p,
      entries: list.filter((e) => e.period === p).sort((a, b) => (parseDate(b.period_start)?.getTime() ?? 0) - (parseDate(a.period_start)?.getTime() ?? 0)),
    })).filter((g) => g.entries.length > 0);
  }, [journal.data]);

  return (
    <Card
      title="Journal"
      icon="journal"
      className="span-2-lg"
      refreshing={journal.refreshing}
      actions={
        <div className="btn-group">
          <label htmlFor="j-filter" className="sr-only">
            Show period
          </label>
          <select id="j-filter" className="input-small" value={period} onChange={(e) => setPeriod(e.target.value as JournalPeriod | "all")}>
            <option value="all">All periods</option>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </select>
          <label htmlFor="j-gen" className="sr-only">
            Period to generate
          </label>
          <select id="j-gen" className="input-small" value={genPeriod} onChange={(e) => setGenPeriod(e.target.value as JournalPeriod)}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-small btn-primary" onClick={() => void generate()} disabled={generating}>
            {generating ? <Spinner size={12} /> : <Icon name="sparkle" size={14} />} {generating ? "Writing…" : "Generate now"}
          </button>
        </div>
      }
    >
      {err && <ErrorState compact error={err} />}
      <AsyncBlock
        state={journal}
        empty={(list) =>
          list.length === 0 ? (
            <EmptyState icon="journal" title="No journal entries yet.">
              <p>Genesis writes these on a schedule. You can also ask for one now.</p>
            </EmptyState>
          ) : null
        }
      >
        {() => (
          <div className="journal">
            {groups.map((g) => (
              <section key={g.period} className="journal-group" aria-label={`${humanize(g.period)} entries`}>
                <h3 className="label">{humanize(g.period)}</h3>
                {g.entries.map((e) => (
                  <JournalCard key={e.id} entry={e} />
                ))}
              </section>
            ))}
          </div>
        )}
      </AsyncBlock>
    </Card>
  );
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  const range =
    entry.period === "daily" ? formatDate(entry.period_start, { dateStyle: "full" }) : `${formatDate(entry.period_start)} – ${formatDate(entry.period_end)}`;
  return (
    <article className="journal-entry">
      <header>
        <h4>{entry.title || range}</h4>
        {entry.title && <p className="muted small">{range}</p>}
      </header>
      <div className="prose">
        {entry.content.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {entry.highlights?.length > 0 && (
        <ul className="highlights" aria-label="Highlights">
          {entry.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function TimelineSection() {
  const timeline = useApi((s) => api.timeline(s), []);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [importance, setImportance] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const ev = await api.addTimelineEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        event_date: date ? new Date(`${date}T12:00:00`).toISOString() : undefined,
        importance,
      });
      timeline.setData((prev) => [...(prev ?? []), ev]);
      setTitle("");
      setDescription("");
      setCategory("");
      setAdding(false);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  const sorted = useMemo(
    () => [...(timeline.data ?? [])].sort((a, b) => (parseDate(b.event_date)?.getTime() ?? 0) - (parseDate(a.event_date)?.getTime() ?? 0)),
    [timeline.data],
  );

  return (
    <Card
      title="Timeline"
      icon="clock"
      refreshing={timeline.refreshing}
      actions={
        <button type="button" className="btn btn-small" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          <Icon name="plus" size={14} /> Add event
        </button>
      }
    >
      {adding && (
        <form className="form-grid boxed" onSubmit={add}>
          <Field label="What happened?">{(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />}</Field>
          <Field label="Details (optional)">
            {(id) => <textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <div className="form-row">
            <Field label="Date">{(id) => <input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Category">
              {(id) => <input id={id} value={category} placeholder="e.g. milestone" onChange={(e) => setCategory(e.target.value)} />}
            </Field>
            <Field label="Importance">
              {(id) => (
                <select id={id} value={importance} onChange={(e) => setImportance(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              )}
            </Field>
          </div>
          {err && <ErrorState compact error={err} />}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? <Spinner size={14} /> : null} Add to timeline
            </button>
          </div>
        </form>
      )}
      <AsyncBlock state={timeline} empty={(l) => (l.length === 0 ? <EmptyState icon="clock" title="No events on the timeline yet." /> : null)}>
        {() => (
          <ol className="timeline">
            {sorted.map((ev) => (
              <TimelineItem key={ev.id} ev={ev} />
            ))}
          </ol>
        )}
      </AsyncBlock>
    </Card>
  );
}

function TimelineItem({ ev }: { ev: TimelineEvent }) {
  const imp = typeof ev.importance === "number" ? (ev.importance >= 0.75 ? "high" : ev.importance >= 0.4 ? "medium" : "low") : String(ev.importance || "medium");
  return (
    <li className={`timeline-item imp-${imp}`}>
      <span className="timeline-dot" aria-hidden="true" />
      <div className="timeline-body">
        <p className="timeline-date">
          <time dateTime={ev.event_date}>{formatDate(ev.event_date)}</time>
          {ev.category && <span className="tag">{ev.category}</span>}
        </p>
        <p className="timeline-title">{ev.title}</p>
        {ev.description && <p className="small muted">{ev.description}</p>}
      </div>
    </li>
  );
}

function ReflectionsSection() {
  const reflections = useApi((s) => api.reflections(s), []);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setErr(null);
    try {
      const r = await api.runReflection();
      reflections.setData((prev) => [r, ...(prev ?? []).filter((x) => x.id !== r.id)]);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setRunning(false);
    }
  };

  const sorted = useMemo(
    () => [...(reflections.data ?? [])].sort((a, b) => (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0)),
    [reflections.data],
  );

  return (
    <Card
      title="Reflections"
      icon="sparkle"
      refreshing={reflections.refreshing}
      actions={
        <button type="button" className="btn btn-small btn-primary" onClick={() => void run()} disabled={running}>
          {running ? <Spinner size={12} /> : <Icon name="sparkle" size={14} />} {running ? "Reflecting…" : "Reflect now"}
        </button>
      }
    >
      {err && <ErrorState compact error={err} />}
      <AsyncBlock
        state={reflections}
        empty={(l) => (l.length === 0 ? <EmptyState icon="sparkle" title="No reflections yet. Genesis reflects periodically on what it has learned." /> : null)}
      >
        {() => (
          <ul className="reflections">
            {sorted.map((r) => (
              <li key={r.id} className="reflection">
                <p className="reflection-q">{r.question}</p>
                <p>{r.content}</p>
                {r.insights?.length > 0 && (
                  <ul className="highlights" aria-label="Insights">
                    {r.insights.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                )}
                <p className="muted small" title={formatDateTime(r.created_at)}>
                  {timeAgo(r.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </Card>
  );
}
