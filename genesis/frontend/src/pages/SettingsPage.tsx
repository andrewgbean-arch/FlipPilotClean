import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  API_BASE,
  api,
  errorMessage,
  getStoredToken,
  setStoredToken,
  type PersonalityProfile,
  type Settings,
} from "../api";
import { Icon } from "../components/Icon";
import { AsyncBlock, Card, EmptyState, ErrorState, Field, PageHeader, Spinner, StatusBadge, Toast, Toggle } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDateTime, formatDuration, humanize, stringifyValue, timeAgo } from "../lib/format";
import { applyTheme, getThemePref, type ThemePref } from "../lib/theme";

const TOGGLES: { key: string; label: string; description: string }[] = [
  { key: "autonomy_enabled", label: "Autonomy", description: "Let Genesis pursue its own goals and background tasks." },
  { key: "proactive_enabled", label: "Proactive messages", description: "Allow check-ins and follow-ups when you're away." },
  { key: "voice_enabled", label: "Voice", description: "Enable speech recognition and spoken replies on the server." },
  { key: "learning_enabled", label: "Learning", description: "Extract memories, profile details and knowledge from conversations." },
  { key: "reflection_enabled", label: "Reflection", description: "Periodically reflect on recent experiences." },
];

const KNOWN_KEYS = new Set([
  "companion_name",
  "user_name",
  "chat_model",
  "question_frequency",
  "response_length",
  "tts_voice",
  "temperature",
  ...TOGGLES.map((t) => t.key),
]);

export default function SettingsPage() {
  const [toast, setToast] = useState<{ msg: string; tone: "info" | "error" } | null>(null);
  const notify = (msg: string, tone: "info" | "error" = "info") => setToast({ msg, tone });

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Tune how Genesis thinks, talks and runs." />
      <div className="grid two-col-lg">
        <CompanionSettingsCard notify={notify} />
        <ConnectionCard notify={notify} />
        <PersonalityCard notify={notify} />
        <AutomationCard notify={notify} />
        <ToolsCard />
        <ToolLogsCard />
      </div>
      <Toast message={toast?.msg ?? null} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}

type Notify = (msg: string, tone?: "info" | "error") => void;

function ConnectionCard({ notify }: { notify: Notify }) {
  const [token, setToken] = useState(getStoredToken());
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [theme, setTheme] = useState<ThemePref>(getThemePref());
  const envToken = Boolean(import.meta.env.VITE_GENESIS_TOKEN);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setStoredToken(token.trim());
    notify(token.trim() ? "API token saved on this device." : "API token cleared.");
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const h = await api.health();
      setResult({ ok: true, text: `Connected · Genesis v${h.version} · ${h.status}` });
    } catch (ex) {
      setResult({ ok: false, text: errorMessage(ex) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title="Connection & appearance" icon="settings">
      <form className="form-grid" onSubmit={save}>
        <Field label="Backend URL" hint="Set at build time with VITE_GENESIS_API.">
          {(id) => <input id={id} value={API_BASE} readOnly />}
        </Field>
        <Field
          label="API token"
          hint={
            <>
              Sent as <code>X-Genesis-Token</code>. Needed only when the backend sets <code>GENESIS_API_TOKEN</code>.
              {envToken && " A build-time token is configured; a token saved here overrides it."}
            </>
          }
        >
          {(id) => (
            <div className="input-with-btn">
              <input id={id} type={show ? "text" : "password"} autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          )}
        </Field>
        <div className="row-end">
          <button type="button" className="btn" onClick={() => void test()} disabled={testing}>
            {testing ? <Spinner size={14} /> : null} Test connection
          </button>
          <button type="submit" className="btn btn-primary">
            Save token
          </button>
        </div>
        <div aria-live="polite">
          {result && <StatusBadge kind={result.ok ? "good" : "critical"}>{result.text}</StatusBadge>}
        </div>
        <fieldset className="segmented">
          <legend>Theme</legend>
          {(["system", "dark", "light"] as ThemePref[]).map((t) => (
            <label key={t} className={theme === t ? "seg on" : "seg"}>
              <input
                type="radio"
                name="theme"
                value={t}
                checked={theme === t}
                onChange={() => {
                  setTheme(t);
                  applyTheme(t);
                }}
              />
              {humanize(t)}
            </label>
          ))}
        </fieldset>
      </form>
    </Card>
  );
}

function CompanionSettingsCard({ notify }: { notify: Notify }) {
  const settings = useApi((s) => api.settings(s), []);
  const health = useApi((s) => api.health(s), []);
  const [draft, setDraft] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const changed = useMemo(() => {
    const base = settings.data ?? {};
    const out: Settings = {};
    for (const [k, v] of Object.entries(draft)) {
      if (JSON.stringify(v) !== JSON.stringify(base[k])) out[k] = v;
    }
    return out;
  }, [draft, settings.data]);
  const dirty = Object.keys(changed).length > 0;

  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));
  const str = (k: string) => stringifyValue(draft[k]);
  const num = (k: string, fallback: number) => {
    const n = Number(draft[k]);
    return Number.isFinite(n) ? n : fallback;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setErr(null);
    try {
      const next = await api.updateSettings(changed);
      settings.setData(next);
      notify("Settings saved.");
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  const extraKeys = Object.keys(draft).filter((k) => !KNOWN_KEYS.has(k));
  const models = health.data?.ollama?.models ?? [];

  return (
    <Card title="Companion" icon="heart" className="span-2-lg" refreshing={settings.refreshing}>
      <AsyncBlock state={settings} rows={6}>
        {() => (
          <form className="form-grid" onSubmit={save}>
            <div className="form-row">
              <Field label="Companion name">{(id) => <input id={id} value={str("companion_name")} onChange={(e) => set("companion_name", e.target.value)} />}</Field>
              <Field label="Your name">{(id) => <input id={id} value={str("user_name")} onChange={(e) => set("user_name", e.target.value)} />}</Field>
            </div>
            <div className="form-row">
              <Field label="Chat model" hint={models.length ? `${models.length} models installed in Ollama` : "Any model installed in Ollama"}>
                {(id) => (
                  <>
                    <input id={id} list="model-options" value={str("chat_model")} onChange={(e) => set("chat_model", e.target.value)} />
                    <datalist id="model-options">
                      {models.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field label="Response length">
                {(id) => (
                  <select id={id} value={str("response_length") || "medium"} onChange={(e) => set("response_length", e.target.value)}>
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                )}
              </Field>
            </div>
            <div className="form-row">
              <Field label={`Question frequency: ${Math.round(num("question_frequency", 50))}`} hint="How often Genesis asks you questions (0 = rarely, 100 = often).">
                {(id) => (
                  <input
                    id={id}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={num("question_frequency", 50)}
                    onChange={(e) => set("question_frequency", Number(e.target.value))}
                  />
                )}
              </Field>
              <Field label={`Temperature: ${num("temperature", 0.7).toFixed(2)}`} hint="Lower is steadier, higher is more playful.">
                {(id) => (
                  <input
                    id={id}
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={num("temperature", 0.7)}
                    onChange={(e) => set("temperature", Number(e.target.value))}
                  />
                )}
              </Field>
            </div>
            <Field label="Voice (Piper TTS)" hint="e.g. en_US-lessac-medium. The browser voice is used when Piper isn't installed.">
              {(id) => <input id={id} value={str("tts_voice")} onChange={(e) => set("tts_voice", e.target.value)} />}
            </Field>
            <div className="toggles">
              {TOGGLES.map((t) => (
                <Toggle key={t.key} label={t.label} description={t.description} checked={Boolean(draft[t.key])} onChange={(v) => set(t.key, v)} />
              ))}
            </div>
            {extraKeys.length > 0 && (
              <details className="advanced">
                <summary>Other settings ({extraKeys.length})</summary>
                <div className="form-grid">
                  {extraKeys.map((k) => {
                    const v = draft[k];
                    if (typeof v === "boolean") return <Toggle key={k} label={humanize(k)} checked={v} onChange={(nv) => set(k, nv)} />;
                    return (
                      <Field key={k} label={humanize(k)}>
                        {(id) => (
                          <input
                            id={id}
                            type={typeof v === "number" ? "number" : "text"}
                            value={stringifyValue(v)}
                            onChange={(e) => set(k, typeof v === "number" ? Number(e.target.value) : e.target.value)}
                          />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </details>
            )}
            {err && <ErrorState compact error={err} />}
            <div className="row-end sticky-actions">
              {dirty && <span className="muted small">{Object.keys(changed).length} unsaved change(s)</span>}
              <button type="button" className="btn btn-ghost" disabled={!dirty || saving} onClick={() => settings.data && setDraft(settings.data)}>
                Reset
              </button>
              <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
                {saving ? <Spinner size={14} /> : <Icon name="check" size={15} />} Save settings
              </button>
            </div>
          </form>
        )}
      </AsyncBlock>
    </Card>
  );
}

function listToText(v: unknown): string {
  return Array.isArray(v) ? v.map(stringifyValue).join("\n") : stringifyValue(v);
}
function textToList(t: string): string[] {
  return t
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function PersonalityCard({ notify }: { notify: Notify }) {
  const personality = useApi((s) => api.personality(s), []);
  const [draft, setDraft] = useState<PersonalityProfile | null>(null);
  const [values, setValues] = useState("");
  const [beliefs, setBeliefs] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = personality.data?.profile;
    if (!p) return;
    setDraft(p);
    setValues(listToText(p.core_values));
    setBeliefs(listToText(p.beliefs));
  }, [personality.data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setErr(null);
    try {
      const next = await api.updatePersonalityProfile({ ...draft, core_values: textToList(values), beliefs: textToList(beliefs) });
      personality.setData(next);
      notify("Personality profile saved.");
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  const scaleInput = (key: "question_frequency" | "teachability", label: string) => {
    if (!draft) return null;
    const v = Number(draft[key] ?? 0); // all three are 0-100
    return (
      <Field label={`${label}: ${Math.round(v)}`}>
        {(id) => (
          <input
            id={id}
            type="range"
            min={0}
            max={100}
            step={1}
            value={v}
            onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
          />
        )}
      </Field>
    );
  };

  return (
    <Card title="Personality profile" icon="sparkle" refreshing={personality.refreshing}>
      <AsyncBlock state={personality} rows={6}>
        {() =>
          draft && (
            <form className="form-grid" onSubmit={save}>
              <Field label="Core values" hint="One per line">
                {(id) => <textarea id={id} rows={3} value={values} onChange={(e) => setValues(e.target.value)} />}
              </Field>
              <Field label="Beliefs" hint="One per line">
                {(id) => <textarea id={id} rows={3} value={beliefs} onChange={(e) => setBeliefs(e.target.value)} />}
              </Field>
              <Field label="Communication style">
                {(id) => <input id={id} value={draft.communication_style ?? ""} onChange={(e) => setDraft({ ...draft, communication_style: e.target.value })} />}
              </Field>
              <Field label="Language style">
                {(id) => <input id={id} value={draft.language_style ?? ""} onChange={(e) => setDraft({ ...draft, language_style: e.target.value })} />}
              </Field>
              <Field label="Humour style">
                {(id) => <input id={id} value={draft.humour_style ?? ""} onChange={(e) => setDraft({ ...draft, humour_style: e.target.value })} />}
              </Field>
              {scaleInput("question_frequency", "Question frequency")}
              {scaleInput("teachability", "Teachability")}
              <p className="hint">
                Curiosity: {Math.round(Number(draft?.curiosity_level ?? 0))}. This comes from the curiosity personality trait, which grows
                with experience, so it can't be set directly.
              </p>
              {err && <ErrorState compact error={err} />}
              <div className="row-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner size={14} /> : <Icon name="check" size={15} />} Save profile
                </button>
              </div>
            </form>
          )
        }
      </AsyncBlock>
    </Card>
  );
}

function AutomationCard({ notify }: { notify: Notify }) {
  const jobs = useApi((s) => api.automationJobs(s), [], { refreshMs: 30000 });
  const [running, setRunning] = useState<string | null>(null);

  const run = async (name: string) => {
    setRunning(name);
    try {
      const r = await api.runAutomationJob(name);
      notify(`${humanize(r.job)}: ${r.status}${r.detail ? ` · ${stringifyValue(r.detail).slice(0, 140)}` : ""}`);
      jobs.reload();
    } catch (ex) {
      notify(`Couldn't run ${name}: ${errorMessage(ex)}`, "error");
    } finally {
      setRunning(null);
    }
  };

  return (
    <Card title="Automation" icon="clock" refreshing={jobs.refreshing}>
      <AsyncBlock state={jobs} empty={(l) => (l.length === 0 ? <EmptyState icon="clock" title="No scheduled jobs." /> : null)}>
        {(list) => (
          <ul className="job-list">
            {list.map((j) => (
              <li key={j.name} className="job">
                <div className="job-main">
                  <span className="job-name">{humanize(j.name)}</span>
                  <span className="muted small">
                    {formatDuration(j.interval_seconds)} · last run {timeAgo(j.last_run)}
                    {j.last_status ? ` · ${j.last_status}` : ""}
                  </span>
                </div>
                <button type="button" className="btn btn-small" onClick={() => void run(j.name)} disabled={running !== null} aria-label={`Run ${humanize(j.name)} now`}>
                  {running === j.name ? <Spinner size={12} /> : <Icon name="play" size={13} />} Run now
                </button>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </Card>
  );
}

function ToolsCard() {
  const tools = useApi((s) => api.tools(s), []);
  return (
    <Card title="Tools" icon="tool">
      <AsyncBlock state={tools} empty={(l) => (l.length === 0 ? <EmptyState icon="tool" title="No tools registered." /> : null)}>
        {(list) => (
          <ul className="tool-list">
            {list.map((t) => (
              <li key={t.name}>
                <details>
                  <summary>
                    <code>{t.name}</code>
                    <span className="muted small"> {t.description}</span>
                  </summary>
                  <pre className="code-block">{JSON.stringify(t.parameters, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </Card>
  );
}

function ToolLogsCard() {
  const logs = useApi((s) => api.toolLogs(s), [], { refreshMs: 30000 });
  return (
    <Card
      title="Recent tool activity"
      icon="file"
      refreshing={logs.refreshing}
      className="span-2-lg"
      actions={
        <button type="button" className="btn btn-small btn-ghost" onClick={logs.reload}>
          <Icon name="refresh" size={13} /> Refresh
        </button>
      }
    >
      <AsyncBlock state={logs} empty={(l) => (l.length === 0 ? <EmptyState icon="tool" title="No tool calls yet." /> : null)}>
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Recent tool calls</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Tool</th>
                  <th scope="col">Status</th>
                  <th scope="col">Arguments</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 50).map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap" title={formatDateTime(l.created_at)}>
                      {timeAgo(l.created_at)}
                    </td>
                    <td>
                      <code>{l.tool_name}</code>
                    </td>
                    <td>
                      <StatusBadge kind={l.ok ? "good" : "critical"}>{l.ok ? "ok" : "failed"}</StatusBadge>
                    </td>
                    <td>
                      <code className="clip">{stringifyValue(l.arguments)}</code>
                    </td>
                    <td className="clip-cell" title={l.result}>
                      {l.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncBlock>
    </Card>
  );
}
