import { useState, type FormEvent } from "react";
import { api, errorMessage, type Profile } from "../api";
import { Icon } from "../components/Icon";
import { AsyncBlock, Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { humanize, pct, stringifyValue, timeAgo, toPercent } from "../lib/format";

/** Parse edited text back into the field's original type where it's obvious. */
function coerce(text: string, original: unknown): unknown {
  if (typeof original === "number") {
    const n = Number(text);
    return Number.isFinite(n) ? n : text;
  }
  if (typeof original === "boolean") return /^(true|yes|1)$/i.test(text.trim());
  if (Array.isArray(original)) {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (original && typeof original === "object") {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function display(v: unknown): string {
  if (Array.isArray(v)) return v.map(stringifyValue).join(", ");
  return stringifyValue(v);
}

export default function ProfilePage() {
  const profile = useApi((s) => api.profile(s), []);

  return (
    <div className="page">
      <PageHeader
        title="Profile"
        subtitle="What Genesis has learned about you. Correct anything that's wrong; your edits are treated as the truth."
        actions={
          <button type="button" className="btn" onClick={profile.reload}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        }
      />
      <div className="grid two-col-lg">
        <Card title="About you" icon="profile" refreshing={profile.refreshing} className="span-2-lg">
          <AsyncBlock state={profile}>{(p) => <ProfileFields profile={p} onChange={profile.setData} />}</AsyncBlock>
        </Card>
        <Card title="Interests" icon="heart" refreshing={profile.refreshing} className="span-2-lg">
          <AsyncBlock
            state={profile}
            empty={(p) => (p.interests.length === 0 ? <EmptyState icon="heart" title="No interests picked up yet." /> : null)}
          >
            {(p) => (
              <ul className="interests">
                {[...p.interests]
                  .sort((a, b) => b.strength - a.strength)
                  .map((i) => (
                    <li key={`${i.category}-${i.name}`} className="interest" title={`Mentioned ${i.mention_count}× · last ${timeAgo(i.last_mentioned)}`}>
                      <div className="interest-head">
                        <span className="interest-name">{i.name}</span>
                        <span className="muted small">{humanize(i.category || "general")}</span>
                      </div>
                      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(toPercent(i.strength))} aria-label={`${i.name} strength`}>
                        <div className="meter-fill" style={{ width: `${toPercent(i.strength)}%`, background: "var(--viz-magenta)" }} />
                      </div>
                      <p className="muted small">
                        strength {pct(i.strength)} · {i.mention_count} mention{i.mention_count === 1 ? "" : "s"}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </AsyncBlock>
        </Card>
      </div>
    </div>
  );
}

function ProfileFields({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newField, setNewField] = useState("");
  const [newValue, setNewValue] = useState("");

  const entries = Object.entries(profile.fields).sort((a, b) => a[0].localeCompare(b[0]));

  const save = async (field: string, value: unknown) => {
    setSaving(true);
    setErr(null);
    try {
      const p = await api.updateProfile(field, value);
      onChange(p);
      setEditing(null);
      return true;
    } catch (ex) {
      setErr(errorMessage(ex));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addField = async (e: FormEvent) => {
    e.preventDefault();
    const key = newField.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newValue.trim()) return;
    if (await save(key, newValue.trim())) {
      setNewField("");
      setNewValue("");
    }
  };

  return (
    <>
      {err && <ErrorState compact error={err} />}
      {entries.length === 0 ? (
        <EmptyState icon="profile" title="Genesis hasn't learned any profile details yet.">
          <p>They'll appear as you chat, or add one below.</p>
        </EmptyState>
      ) : (
        <ul className="profile-fields">
          {entries.map(([key, f]) => (
            <li key={key} className="profile-field">
              <div className="profile-key">{humanize(key)}</div>
              {editing === key ? (
                <form
                  className="profile-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(key, coerce(draft, f.value));
                  }}
                >
                  <label htmlFor={`pf-${key}`} className="sr-only">
                    {humanize(key)}
                  </label>
                  <input
                    id={`pf-${key}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button type="submit" className="icon-btn" aria-label="Save" disabled={saving}>
                    {saving ? <Spinner size={14} /> : <Icon name="check" />}
                  </button>
                  <button type="button" className="icon-btn" aria-label="Cancel editing" onClick={() => setEditing(null)}>
                    <Icon name="x" />
                  </button>
                </form>
              ) : (
                <div className="profile-value">
                  <span>{display(f.value) || <span className="muted">—</span>}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit ${humanize(key)}`}
                    onClick={() => {
                      setEditing(key);
                      setDraft(display(f.value));
                    }}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                </div>
              )}
              <div className="profile-meta muted small">
                {pct(f.confidence, 1)} sure · from {f.source} · {timeAgo(f.updated_at)}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="inline-form add-field" onSubmit={addField}>
        <label htmlFor="pf-new-key" className="sr-only">
          New field name
        </label>
        <input id="pf-new-key" placeholder="Field (e.g. hometown)" value={newField} onChange={(e) => setNewField(e.target.value)} />
        <label htmlFor="pf-new-val" className="sr-only">
          New field value
        </label>
        <input id="pf-new-val" placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={saving || !newField.trim() || !newValue.trim()}>
          <Icon name="plus" size={15} /> Add
        </button>
      </form>
    </>
  );
}
