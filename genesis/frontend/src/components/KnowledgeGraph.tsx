import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { KnowledgeGraph as Graph } from "../api/types";
import { humanize } from "../lib/format";

/** Categorical slots in the palette's fixed order. A 9th+ type folds into "other". */
const SLOTS = [
  "var(--viz-blue)",
  "var(--viz-orange)",
  "var(--viz-aqua)",
  "var(--viz-yellow)",
  "var(--viz-magenta)",
  "var(--viz-green)",
  "var(--viz-violet)",
  "var(--viz-red)",
];
const OTHER = "var(--viz-other)";

interface SimNode {
  id: string;
  label: string;
  type: string;
  weight: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  degree: number;
}

interface SimEdge {
  key: string;
  source: SimNode;
  target: SimNode;
  relation: string;
  confidence: number;
}

export function typeColors(types: string[]): Map<string, string> {
  // Alphabetical so a type keeps its colour when others come and go.
  const sorted = [...new Set(types)].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  sorted.forEach((t, i) => map.set(t, i < SLOTS.length ? SLOTS[i] : OTHER));
  return map;
}

export function KnowledgeGraphView({ graph }: { graph: Graph }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [, setFrame] = useState(0);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [focusType, setFocusType] = useState<string | null>(null);
  const alphaRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const colors = useMemo(() => typeColors(graph.nodes.map((n) => n.type || "other")), [graph.nodes]);

  // Build simulation state whenever the graph data changes (keeping positions of known nodes).
  const simRef = useRef<{ nodes: SimNode[]; edges: SimEdge[]; byId: Map<string, SimNode> }>({ nodes: [], edges: [], byId: new Map() });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const sim = useMemo(() => {
    const prev = simRef.current.byId;
    const maxW = Math.max(1, ...graph.nodes.map((n) => Number(n.weight) || 0));
    const byId = new Map<string, SimNode>();
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    graph.nodes.forEach((n, i) => {
      const id = String(n.id);
      const old = prev.get(id);
      const angle = i * 2.399963; // golden angle spiral for a tidy start
      const rad = 12 * Math.sqrt(i + 1);
      byId.set(id, {
        id,
        label: n.label || id,
        type: n.type || "other",
        weight: Number(n.weight) || 0,
        r: 5 + 11 * Math.sqrt((Number(n.weight) || 0) / maxW),
        x: old?.x ?? cx + rad * Math.cos(angle),
        y: old?.y ?? cy + rad * Math.sin(angle),
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        degree: 0,
      });
    });
    const edges: SimEdge[] = [];
    graph.edges.forEach((e, i) => {
      const s = byId.get(String(e.source));
      const t = byId.get(String(e.target));
      if (!s || !t || s === t) return;
      s.degree++;
      t.degree++;
      edges.push({ key: `${s.id}->${t.id}-${i}`, source: s, target: t, relation: e.relation, confidence: e.confidence });
    });
    alphaRef.current = 1;
    return { nodes: [...byId.values()], edges, byId };
  }, [graph]);
  simRef.current = sim;

  const tick = useCallback(() => {
    const { nodes, edges } = simRef.current;
    const alpha = alphaRef.current;
    const { w, h } = size;
    const n = nodes.length;
    const charge = n > 150 ? -140 : -260;

    // Repulsion (O(n^2); fine for the few hundred nodes a personal graph has).
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          d2 = dx * dx + dy * dy;
        }
        const minD = a.r + b.r + 6;
        const f = (charge * alpha) / Math.max(d2, 25);
        let fx = dx * f;
        let fy = dy * f;
        if (d2 < minD * minD) {
          // Collision: push overlapping nodes apart.
          const d = Math.sqrt(d2);
          const push = ((minD - d) / d) * 0.5;
          fx -= dx * push;
          fy -= dy * push;
        }
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    // Springs.
    for (const e of edges) {
      const dx = e.target.x - e.source.x;
      const dy = e.target.y - e.source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const L = 60 + e.source.r + e.target.r;
      const k = (0.08 * alpha * (d - L)) / d;
      const bias = e.source.degree / (e.source.degree + e.target.degree);
      e.target.vx -= dx * k * bias;
      e.target.vy -= dy * k * bias;
      e.source.vx += dx * k * (1 - bias);
      e.source.vy += dy * k * (1 - bias);
    }
    // Gravity toward the centre, integrate, keep inside the viewport.
    const pad = 24;
    for (const node of nodes) {
      node.vx += (w / 2 - node.x) * 0.012 * alpha;
      node.vy += (h / 2 - node.y) * 0.016 * alpha;
      if (node.fx !== null && node.fy !== null) {
        node.x = node.fx;
        node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= 0.6;
      node.vy *= 0.6;
      node.x = Math.max(pad + node.r, Math.min(w - pad - node.r, node.x + node.vx));
      node.y = Math.max(pad + node.r, Math.min(h - pad - node.r, node.y + node.vy));
    }
    alphaRef.current = alpha + (0 - alpha) * 0.025;
  }, [size]);

  const tickRef = useRef(tick);
  tickRef.current = tick;

  const loop = useCallback(() => {
    tickRef.current();
    setFrame((f) => (f + 1) % 1_000_000);
    if (alphaRef.current > 0.004 || dragRef.current) rafRef.current = requestAnimationFrame(loop);
    else rafRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  // Responsive size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(280, Math.round(entry.contentRect.width));
      const h = Math.max(320, Math.min(640, Math.round(w * 0.62)));
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
      alphaRef.current = Math.max(alphaRef.current, 0.3);
      start();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [start]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Settle the layout off-screen, then draw once.
      for (let i = 0; i < 300 && alphaRef.current > 0.004; i++) tickRef.current();
      setFrame((f) => f + 1);
    } else start();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [graph, start]);

  // ---- Dragging ----
  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: clientX, y: clientY };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onNodePointerDown = (e: PointerEvent<SVGGElement>, id: string) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId };
    const node = simRef.current.byId.get(id);
    if (node) {
      const p = toSvg(e.clientX, e.clientY);
      node.fx = p.x;
      node.fy = p.y;
    }
    alphaRef.current = Math.max(alphaRef.current, 0.3);
    start();
  };
  const onNodePointerMove = (e: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const node = simRef.current.byId.get(drag.id);
    if (!node) return;
    const p = toSvg(e.clientX, e.clientY);
    node.fx = Math.max(node.r, Math.min(size.w - node.r, p.x));
    node.fy = Math.max(node.r, Math.min(size.h - node.r, p.y));
    alphaRef.current = Math.max(alphaRef.current, 0.15);
  };
  const onNodePointerUp = (e: PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const node = simRef.current.byId.get(drag.id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    dragRef.current = null;
    start();
  };
  const onNodeKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const node = simRef.current.byId.get(id);
    if (!node) return;
    const step = e.shiftKey ? 30 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    node.x = Math.max(node.r, Math.min(size.w - node.r, node.x + m[0]));
    node.y = Math.max(node.r, Math.min(size.h - node.r, node.y + m[1]));
    node.fx = node.x;
    node.fy = node.y;
    alphaRef.current = Math.max(alphaRef.current, 0.1);
    start();
    window.setTimeout(() => {
      node.fx = null;
      node.fy = null;
    }, 600);
  };

  const reheat = () => {
    const { nodes } = simRef.current;
    nodes.forEach((n, i) => {
      const angle = i * 2.399963;
      const rad = 12 * Math.sqrt(i + 1);
      n.x = size.w / 2 + rad * Math.cos(angle);
      n.y = size.h / 2 + rad * Math.sin(angle);
      n.fx = n.fy = null;
    });
    alphaRef.current = 1;
    start();
  };

  const { nodes, edges } = simRef.current;
  const active = hoverNode;
  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (!active) return s;
    for (const e of edges) {
      if (e.source.id === active) s.add(e.target.id);
      if (e.target.id === active) s.add(e.source.id);
    }
    return s;
  }, [active, edges]);

  const labelCutoff = useMemo(() => {
    if (nodes.length <= 30) return -Infinity;
    const ws = nodes.map((n) => n.weight).sort((a, b) => b - a);
    return ws[Math.min(ws.length - 1, 24)];
  }, [nodes]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    nodes.forEach((n) => m.set(n.type, (m.get(n.type) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [nodes]);

  const hovered = active ? simRef.current.byId.get(active) : undefined;

  return (
    <div className="kg">
      <div className="kg-toolbar">
        <ul className="legend" aria-label="Node types (select to highlight)">
          {typeCounts.map(([t, count]) => (
            <li key={t}>
              <button
                type="button"
                className={focusType === t ? "legend-item on" : "legend-item"}
                aria-pressed={focusType === t}
                onClick={() => setFocusType((f) => (f === t ? null : t))}
              >
                <span className="swatch round" style={{ background: colors.get(t) }} aria-hidden="true" />
                {humanize(t)} <span className="muted">{count}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-small btn-ghost" onClick={reheat}>
          Re-layout
        </button>
      </div>
      <div className="kg-canvas" ref={wrapRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size.w} ${size.h}`}
          width="100%"
          height={size.h}
          role="img"
          aria-label={`Knowledge graph with ${nodes.length} entities and ${edges.length} relationships. Use Tab to move between entities and arrow keys to move one.`}
        >
          <g className="kg-edges">
            {edges.map((e) => {
              const isActive = hoverEdge === e.key || (active !== null && (e.source.id === active || e.target.id === active));
              const dim = (active !== null && !isActive) || (focusType !== null && e.source.type !== focusType && e.target.type !== focusType);
              return (
                <g
                  key={e.key}
                  className={`kg-edge${isActive ? " active" : ""}${dim ? " dim" : ""}`}
                  onPointerEnter={() => setHoverEdge(e.key)}
                  onPointerLeave={() => setHoverEdge((k) => (k === e.key ? null : k))}
                >
                  <line x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y} className="kg-edge-hit" />
                  <line
                    x1={e.source.x}
                    y1={e.source.y}
                    x2={e.target.x}
                    y2={e.target.y}
                    className="kg-edge-line"
                    style={{ strokeOpacity: 0.35 + 0.5 * Math.max(0, Math.min(1, e.confidence ?? 0.5)) }}
                  />
                </g>
              );
            })}
          </g>
          <g className="kg-nodes">
            {nodes.map((n) => {
              const isActive = active === n.id || neighbours.has(n.id);
              const dim = (active !== null && !isActive) || (focusType !== null && n.type !== focusType);
              const showLabel = isActive || n.weight >= labelCutoff || focusType === n.type;
              return (
                <g
                  key={n.id}
                  className={`kg-node${active === n.id ? " active" : ""}${dim ? " dim" : ""}`}
                  transform={`translate(${n.x},${n.y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label}, ${humanize(n.type)}, ${n.degree} connection${n.degree === 1 ? "" : "s"}`}
                  onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onPointerCancel={onNodePointerUp}
                  onPointerEnter={() => setHoverNode(n.id)}
                  onPointerLeave={() => !dragRef.current && setHoverNode((h) => (h === n.id ? null : h))}
                  onFocus={() => setHoverNode(n.id)}
                  onBlur={() => setHoverNode((h) => (h === n.id ? null : h))}
                  onKeyDown={(e) => onNodeKey(e, n.id)}
                >
                  <circle r={n.r + 6} className="kg-node-hit" />
                  <circle r={n.r} fill={colors.get(n.type)} className="kg-node-dot" />
                  {showLabel && (
                    <text className="kg-label" y={n.r + 13} textAnchor="middle">
                      {n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g className="kg-edge-labels" aria-hidden="true">
            {edges
              .filter((e) => hoverEdge === e.key || (active !== null && (e.source.id === active || e.target.id === active)))
              .map((e) => (
                <text key={e.key} className="kg-edge-label" x={(e.source.x + e.target.x) / 2} y={(e.source.y + e.target.y) / 2 - 4} textAnchor="middle">
                  {e.relation}
                </text>
              ))}
          </g>
        </svg>
      </div>
      <p className="kg-info" aria-live="polite">
        {hovered ? (
          <>
            <strong>{hovered.label}</strong> · {humanize(hovered.type)} · weight {hovered.weight.toFixed(2)} · {hovered.degree} connection
            {hovered.degree === 1 ? "" : "s"}
          </>
        ) : (
          <span className="muted">Hover or focus an entity to see its relationships. Drag to rearrange.</span>
        )}
      </p>
    </div>
  );
}
