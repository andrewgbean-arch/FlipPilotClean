import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, GOAL_TYPES, RELATIONSHIP_LEVELS, type Goal, type GoalType, type Health } from "../api";
import { Icon } from "../components/Icon";
import { AsyncBlock, Card, EmptyState, ImportancePill, Meter, PageHeader, Spinner, StatusBadge, type StatusKind } from "../components/ui";
import { MoodBadge } from "../components/chat/EmotionStrip";
import { useApi, type ApiState } from "../hooks/useApi";
import { modelProblems } from "../lib/health";
import { EMOTIONS } from "../lib/emotions";
import { compactNumber, formatDateTime, humanize, timeAgo, toPercent } from "../lib/format";

const REFRESH_MS = 15000;

export default function DashboardPage() {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const emotions = useApi((s) => api.emotions(s).then((r) => (setLastUpdated(new Date()), r)), [], { refreshMs: REFRESH_MS });
  const personality = useApi((s) => api.personality(s), [], { refreshMs: REFRESH_MS });
  const relationship = useApi((s) => api.relationship(s), [], { refreshMs: REFRESH_MS });
  const goals = useApi((s) => api.goals("active", s), [], { refreshMs: REFRESH_MS });
  const memories = useApi((s) => api.memories({ limit: 8 }, s), [], { refreshMs: REFRESH_MS });
  const stats = useApi((s) => api.stats(s), [], { refreshMs: REFRESH_MS });
  const health = useApi((s) => api.health(s), [], { refreshMs: REFRESH_MS });

  const refreshAll = () => [emotions, personality, relationship, goals, memories, stats, health].forEach((x) => x.reload());

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={<>How Genesis is feeling, growing and running. Refreshes every 15 seconds · updated {timeAgo(lastUpdated.toISOString())}</>}
        actions={
          <button type="button" className="btn" onClick={refreshAll}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        }
      />
      <div className="grid dashboard-grid">
        <Card title="Emotional state" icon="heart" refreshing={emotions.refreshing} className="span-2-md">
          <AsyncBlock state={emotions} rows={6}>
            {(e) => (
              <>
                <p className="card-lead">
                  Mood right now: <MoodBadge mood={e.mood} />
                </p>
                <div className="meters">
                  {EMOTIONS.map((em) => (
                    <Meter key={em.name} label={em.label} value={Number(e.current?.[em.name] ?? 0)} color={em.color} swatch />
                  ))}
                </div>
                {e.history?.length > 0 && (
                  <p className="hint">
                    Last change {timeAgo(e.history[e.history.length - 1]?.timestamp)}
                    {e.history[e.history.length - 1]?.trigger ? `: ${e.history[e.history.length - 1].trigger}` : ""}
                  </p>
                )}
              </>
            )}
          </AsyncBlock>
        </Card>

        <Card title="Relationship" icon="profile" refreshing={relationship.refreshing}>
          <AsyncBlock state={relationship} rows={5}>
            {(r) => {
              const idx = RELATIONSHIP_LEVELS.indexOf(r.level as (typeof RELATIONSHIP_LEVELS)[number]);
              return (
                <>
                  <div className="rel-level">
                    <span className="rel-level-name">{r.level}</span>
                    <span className="muted">{r.interaction_count} interactions</span>
                  </div>
                  <ol className="rel-steps" aria-label="Relationship levels">
                    {RELATIONSHIP_LEVELS.map((l, i) => (
                      <li key={l} className={i < idx ? "done" : i === idx ? "current" : ""} title={l}>
                        <span className="sr-only">
                          {l}
                          {i === idx ? " (current)" : i < idx ? " (reached)" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {r.next_level ? (
                    <Meter label={`Progress to ${r.next_level}`} value={r.progress_to_next} color="var(--accent)" />
                  ) : (
                    <p className="card-lead">The deepest level of companionship.</p>
                  )}
                  <div className="meters compact">
                    <Meter label="Trust" value={r.trust} color="var(--viz-blue)" />
                    <Meter label="Familiarity" value={r.familiarity} color="var(--viz-blue)" />
                    <Meter label="Conversation depth" value={r.conversation_depth} color="var(--viz-blue)" />
                    <Meter label="Support" value={r.support_level} color="var(--viz-blue)" />
                  </div>
                  <dl className="kv">
                    <dt>Score</dt>
                    <dd>{Math.round(toPercent(r.score))}</dd>
                    <dt>Shared experiences</dt>
                    <dd>{r.shared_experiences}</dd>
                  </dl>
                  {r.shared_interests?.length > 0 && (
                    <div className="tags" aria-label="Shared interests">
                      {r.shared_interests.map((i) => (
                        <span key={i} className="tag">
                          {i}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            }}
          </AsyncBlock>
        </Card>

        <Card title="Personality" icon="sparkle" refreshing={personality.refreshing}>
          <AsyncBlock
            state={personality}
            rows={6}
            empty={(p) => (p.traits.length === 0 ? <EmptyState title="No traits reported yet." /> : null)}
          >
            {(p) => (
              <>
                <div className="meters compact">
                  {p.traits.map((t) => (
                    <Meter
                      key={t.name}
                      label={humanize(t.name)}
                      value={t.value}
                      baseline={t.baseline}
                      color="var(--viz-violet)"
                      hint={t.description}
                    />
                  ))}
                </div>
                <p className="hint">
                  <span className="baseline-key" aria-hidden="true" /> marks each trait's baseline; traits drift with experience.
                </p>
              </>
            )}
          </AsyncBlock>
        </Card>

        <GoalsCard goals={goals} />

        <Card
          title="Recent memories"
          icon="memory"
          refreshing={memories.refreshing}
          actions={
            <Link className="btn btn-small btn-ghost" to="/memories">
              All memories
            </Link>
          }
        >
          <AsyncBlock
            state={memories}
            empty={(m) => (m.length === 0 ? <EmptyState icon="memory" title="No memories yet. They form as you talk." /> : null)}
          >
            {(list) => (
              <ul className="mini-list">
                {list.map((m) => (
                  <li key={m.id}>
                    <div className="mini-list-main">
                      <span className="mini-list-title">{m.title || m.content.slice(0, 60)}</span>
                      <span className="muted small">
                        {m.memory_type} · {timeAgo(m.created_at)}
                      </span>
                    </div>
                    <ImportancePill importance={m.importance} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Card>

        <Card title="Conversation statistics" icon="chat" refreshing={stats.refreshing}>
          <AsyncBlock state={stats}>
            {(s) => (
              <>
                <div className="stat-grid">
                  <Stat label="Conversations" value={s.conversations} />
                  <Stat label="Messages" value={s.messages} />
                  <Stat label="Memories" value={s.memories?.total} />
                  <Stat label="Knowledge items" value={s.knowledge_items} />
                  <Stat label="Entities" value={s.entities} />
                  <Stat label="Goals active" value={s.goals?.active} />
                  <Stat label="Goals completed" value={s.goals?.completed} />
                  <Stat label="Journal entries" value={s.journal_entries} />
                  <Stat label="Reflections" value={s.reflections} />
                  <Stat label="Timeline events" value={s.timeline_events} />
                </div>
                {s.memories?.by_type && Object.keys(s.memories.by_type).length > 0 && (
                  <Breakdown title="Memories by type" data={s.memories.by_type} />
                )}
                {s.memories?.by_importance && Object.keys(s.memories.by_importance).length > 0 && (
                  <Breakdown title="Memories by importance" data={s.memories.by_importance} order={["critical", "high", "medium", "low"]} />
                )}
              </>
            )}
          </AsyncBlock>
        </Card>

        <Card title="System health" icon="info" refreshing={health.refreshing}>
          <AsyncBlock state={health}>{(h) => <HealthView h={h} />}</AsyncBlock>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="stat">
      <span className="stat-value">{compactNumber(value ?? 0)}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Breakdown({ title, data, order }: { title: string; data: Record<string, number>; order?: string[] }) {
  const entries = Object.entries(data).sort((a, b) => {
    if (order) return order.indexOf(a[0]) - order.indexOf(b[0]);
    return b[1] - a[1];
  });
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="breakdown">
      <h3 className="label">{title}</h3>
      <table className="bar-table">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{humanize(k)}</th>
              <td>
                <span className="hbar" style={{ width: `${(v / max) * 100}%` }} aria-hidden="true" />
              </td>
              <td className="num">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function voiceAvailable(x: unknown): { ok: boolean; text: string } {
  if (typeof x === "boolean") return { ok: x, text: x ? "available" : "unavailable" };
  if (typeof x === "string") return { ok: !/unavail|missing|error|none|disabled/i.test(x), text: x };
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    const ok = Boolean(o.available ?? o.ok);
    const detail = [o.model, o.voice, o.engine].filter(Boolean).join(" · ");
    return { ok, text: `${ok ? "available" : "unavailable"}${detail ? ` · ${detail}` : ""}` };
  }
  return { ok: false, text: "unknown" };
}

function HealthRow({ label, kind, children }: { label: string; kind: StatusKind; children: ReactNode }) {
  return (
    <li className="health-row">
      <span className="health-label">{label}</span>
      <span className="health-value">{children}</span>
      <StatusBadge kind={kind}>{kind === "good" ? "OK" : kind === "warning" ? "Limited" : kind === "neutral" ? "Info" : "Down"}</StatusBadge>
    </li>
  );
}

function HealthView({ h }: { h: Health }) {
  const stt = voiceAvailable(h.voice?.stt);
  const tts = voiceAvailable(h.voice?.tts);
  const problems = modelProblems(h);
  const modelsOk = h.ollama?.available && h.ollama.chat_model_installed !== false && h.ollama.embed_model_installed !== false;
  return (
    <>
      <p className="card-lead">
        <StatusBadge kind={h.status === "ok" ? "good" : "warning"}>{h.status === "ok" ? "All systems ok" : "Degraded"}</StatusBadge>{" "}
        <span className="muted small">v{h.version}</span>
      </p>
      <ul className="health">
        <HealthRow label="Ollama" kind={!h.ollama?.available ? "critical" : modelsOk ? "good" : "warning"}>
          {h.ollama?.available ? `chat ${h.ollama.chat_model} · embed ${h.ollama.embed_model}` : "not reachable"}
        </HealthRow>
        <HealthRow label="Vector store" kind="good">
          {h.vector_store?.backend} · {compactNumber(h.vector_store?.count)} vectors
        </HealthRow>
        <HealthRow label="Database" kind={h.database?.ok ? "good" : "critical"}>
          <span className="truncate" title={h.database?.path}>
            {h.database?.path}
          </span>
        </HealthRow>
        <HealthRow label="Speech to text" kind={stt.ok ? "good" : "warning"}>
          {stt.text}
        </HealthRow>
        <HealthRow label="Text to speech" kind={tts.ok ? "good" : "warning"}>
          {tts.ok ? tts.text : "not installed · browser voice used"}
        </HealthRow>
        <HealthRow label="Vision" kind={h.vision?.available ? "good" : "warning"}>
          {h.vision?.model || "—"}
        </HealthRow>
        <HealthRow label="Scheduler" kind={h.scheduler?.running ? "good" : "warning"}>
          {h.scheduler?.running ? "running" : "stopped"}
        </HealthRow>
      </ul>
      {problems.length > 0 && (
        <ul className="health-hints" aria-label="How to fix">
          {problems.map((p) => (
            <li key={p.text}>
              <Icon name="alert" size={14} /> <span>{p.text}</span> {p.command && <code>{p.command}</code>}
            </li>
          ))}
        </ul>
      )}
      {h.ollama?.models?.length > 0 && (
        <details className="models">
          <summary>{h.ollama.models.length} installed models</summary>
          <div className="tags">
            {h.ollama.models.map((m) => (
              <span key={m} className="tag">
                {m}
              </span>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function GoalsCard({ goals }: { goals: ApiState<Goal[]> }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("personal_development");
  const [horizon, setHorizon] = useState<"short" | "medium" | "long">("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const g = await api.createGoal({ title: title.trim(), goal_type: goalType, horizon, owner: "user" });
      goals.setData((prev) => [g, ...(prev ?? [])]);
      setTitle("");
      setAdding(false);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Active goals"
      icon="target"
      refreshing={goals.refreshing}
      className="span-2-md"
      actions={
        <button type="button" className="btn btn-small" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          <Icon name="plus" size={14} /> Add goal
        </button>
      }
    >
      {adding && (
        <form className="inline-form" onSubmit={add}>
          <label className="sr-only" htmlFor="goal-title">
            Goal title
          </label>
          <input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to achieve?" required autoFocus />
          <label className="sr-only" htmlFor="goal-type">
            Goal type
          </label>
          <select id="goal-type" value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
            {GOAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="goal-horizon">
            Horizon
          </label>
          <select id="goal-horizon" value={horizon} onChange={(e) => setHorizon(e.target.value as "short" | "medium" | "long")}>
            <option value="short">Short term</option>
            <option value="medium">Medium term</option>
            <option value="long">Long term</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner size={14} /> : "Add"}
          </button>
          {err && <p className="form-error">{err}</p>}
        </form>
      )}
      <AsyncBlock
        state={goals}
        empty={(g) => (g.length === 0 ? <EmptyState icon="target" title="No active goals. Add one, or mention one in chat." /> : null)}
      >
        {(list) => (
          <ul className="goal-list">
            {list.map((g) => (
              <GoalRow key={g.id} goal={g} onChange={(ng) => goals.setData((prev) => (prev ?? []).map((x) => (x.id === ng.id ? ng : x)).filter((x) => x.status === "active"))} />
            ))}
          </ul>
        )}
      </AsyncBlock>
    </Card>
  );
}

function GoalRow({ goal, onChange }: { goal: Goal; onChange: (g: Goal) => void }) {
  const [progress, setProgress] = useState(Math.round(goal.progress));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = progress !== Math.round(goal.progress);

  const update = async (body: { progress?: number; status?: "completed"; note?: string }) => {
    setSaving(true);
    setErr(null);
    try {
      const g = await api.updateGoal({ goal_id: goal.id, ...body });
      onChange(g);
      setProgress(Math.round(g.progress));
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="goal">
      <div className="goal-head">
        <div>
          <p className="goal-title">{goal.title}</p>
          <p className="muted small">
            {humanize(goal.goal_type)} · {goal.horizon} term · {goal.owner === "companion" ? "Genesis's goal" : "your goal"}
            {goal.next_follow_up_at ? ` · follow-up ${timeAgo(goal.next_follow_up_at)}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => void update({ status: "completed", progress: 100, note: "Marked complete from dashboard" })}
          disabled={saving}
        >
          <Icon name="check" size={14} /> Complete
        </button>
      </div>
      <div className="goal-progress">
        <label className="sr-only" htmlFor={`goal-${goal.id}-progress`}>
          Progress for {goal.title}
        </label>
        <input
          id={`goal-${goal.id}-progress`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
        <span className="goal-pct">{progress}%</span>
        {dirty && (
          <button type="button" className="btn btn-small btn-primary" onClick={() => void update({ progress })} disabled={saving}>
            {saving ? <Spinner size={12} /> : "Save"}
          </button>
        )}
      </div>
      {goal.description && <p className="small muted">{goal.description}</p>}
      {err && <p className="form-error">{err}</p>}
      <p className="sr-only">Last updated {formatDateTime(goal.updated_at)}</p>
    </li>
  );
}
