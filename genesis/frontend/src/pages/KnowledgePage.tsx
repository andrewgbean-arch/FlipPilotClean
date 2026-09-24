import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { api, errorMessage, type DocumentUploadResult } from "../api";
import { Icon } from "../components/Icon";
import { KnowledgeGraphView } from "../components/KnowledgeGraph";
import { AsyncBlock, Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { formatDate, pct } from "../lib/format";

export default function KnowledgePage() {
  const graph = useApi((s) => api.knowledgeGraph(s), []);
  const items = useApi((s) => api.knowledge(200, s), []);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!items.data) return [];
    if (!q) return items.data;
    return items.data.filter((k) => [k.statement, k.subject, k.predicate, k.object, k.source].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [items.data, filter]);

  const refresh = () => {
    graph.reload();
    items.reload();
  };

  return (
    <div className="page">
      <PageHeader
        title="Knowledge"
        subtitle="The facts, people, places and ideas Genesis has connected from your conversations and documents."
        actions={
          <button type="button" className="btn" onClick={refresh}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        }
      />

      <Card title="Knowledge graph" icon="knowledge" refreshing={graph.refreshing}>
        <AsyncBlock
          state={graph}
          rows={6}
          empty={(g) =>
            g.nodes.length === 0 ? (
              <EmptyState icon="knowledge" title="The graph is empty for now.">
                <p>As you talk about people, places and interests, Genesis links them together here.</p>
              </EmptyState>
            ) : null
          }
        >
          {(g) => <KnowledgeGraphView graph={g} />}
        </AsyncBlock>
      </Card>

      <div className="grid two-col-lg">
        <Card
          title="Knowledge items"
          icon="file"
          refreshing={items.refreshing}
          className="span-2-lg"
          actions={
            <>
              <label htmlFor="k-filter" className="sr-only">
                Filter knowledge
              </label>
              <input id="k-filter" type="search" className="input-small" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </>
          }
        >
          <AsyncBlock
            state={items}
            empty={(list) => (list.length === 0 ? <EmptyState icon="file" title="No knowledge items yet." /> : null)}
          >
            {() =>
              filtered.length === 0 ? (
                <p className="muted">Nothing matches “{filter}”.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="sr-only">Knowledge items</caption>
                    <thead>
                      <tr>
                        <th scope="col">Statement</th>
                        <th scope="col">Subject · predicate · object</th>
                        <th scope="col">Source</th>
                        <th scope="col" className="num">
                          Confidence
                        </th>
                        <th scope="col" className="num">
                          Recalled
                        </th>
                        <th scope="col">Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((k) => (
                        <tr key={k.id}>
                          <td>{k.statement}</td>
                          <td className="triple">
                            {k.subject || k.predicate || k.object ? (
                              <>
                                <span>{k.subject}</span> <span className="muted">{k.predicate}</span> <span>{k.object}</span>
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>{k.source}</td>
                          <td className="num">{pct(k.confidence, 1)}</td>
                          <td className="num">{k.retrieval_count}</td>
                          <td className="nowrap">{formatDate(k.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </AsyncBlock>
        </Card>

        <DocumentUpload onUploaded={refresh} />
        <AddFact onAdded={refresh} />
      </div>
    </div>
  );
}

function DocumentUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [result, setResult] = useState<(DocumentUploadResult & { name: string }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setErr("Only .txt and .md files are supported.");
      return;
    }
    setErr(null);
    setResult(null);
    setUploading(file.name);
    try {
      const r = await api.uploadDocument(file);
      setResult({ ...r, name: file.name });
      onUploaded();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setUploading(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void upload(e.dataTransfer.files?.[0]);
  };

  return (
    <Card title="Teach from a document" icon="upload">
      <div
        className={dragOver ? "dropzone over" : "dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Icon name="file" size={26} />
        <p>Drop a .txt or .md file here, or</p>
        <input ref={inputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={!!uploading}>
          {uploading ? <Spinner size={14} /> : <Icon name="upload" size={15} />} {uploading ? `Reading ${uploading}…` : "Choose file"}
        </button>
      </div>
      <div aria-live="polite">
        {err && <ErrorState compact error={err} />}
        {result && (
          <p className="success-note">
            <Icon name="check" size={15} /> Learned from <strong>{result.name}</strong>: {result.chunks} chunk{result.chunks === 1 ? "" : "s"},{" "}
            {result.memories_created} new memor{result.memories_created === 1 ? "y" : "ies"}.
          </p>
        )}
      </div>
    </Card>
  );
}

function AddFact({ onAdded }: { onAdded: () => void }) {
  const [statement, setStatement] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!statement.trim()) return;
    setSaving(true);
    setErr(null);
    setDone(false);
    try {
      await api.addKnowledge({ statement: statement.trim(), source: "user" });
      setStatement("");
      setDone(true);
      onAdded();
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Add a fact" icon="plus">
      <form className="form-grid" onSubmit={submit}>
        <label htmlFor="fact" className="sr-only">
          Fact
        </label>
        <textarea id="fact" rows={3} placeholder="e.g. My sister Maya lives in Lisbon." value={statement} onChange={(e) => setStatement(e.target.value)} />
        <div className="row-end">
          <button type="submit" className="btn btn-primary" disabled={saving || !statement.trim()}>
            {saving ? <Spinner size={14} /> : <Icon name="plus" size={15} />} Add fact
          </button>
        </div>
        <div aria-live="polite">
          {err && <ErrorState compact error={err} />}
          {done && <p className="success-note">Saved.</p>}
        </div>
      </form>
    </Card>
  );
}
