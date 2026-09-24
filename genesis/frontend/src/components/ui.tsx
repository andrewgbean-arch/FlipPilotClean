import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { toPercent } from "../lib/format";
import type { Importance } from "../api/types";

export function Spinner({ label = "Loading", size = 18 }: { label?: string; size?: number }) {
  return (
    <span className="spinner" role="status" aria-label={label} style={{ width: size, height: size }} />
  );
}

export function Loading({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${92 - i * 14}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyState({ icon = "sparkle", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "error-state compact" : "error-state"} role="alert">
      <Icon name="alert" />
      <span className="error-text">{error}</span>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Retry
        </button>
      )}
    </div>
  );
}

/** Loading / error / empty handling in one place. */
export function AsyncBlock<T>({
  state,
  children,
  empty,
  rows,
}: {
  state: { data: T | undefined; error: string | null; loading: boolean; reload: () => void };
  children: (data: T) => ReactNode;
  empty?: (data: T) => ReactNode | null;
  rows?: number;
}) {
  if (state.data === undefined) {
    if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
    return <Loading rows={rows} />;
  }
  const emptyNode = empty ? empty(state.data) : null;
  return (
    <>
      {state.error && <ErrorState compact error={`Showing last known data. ${state.error}`} onRetry={state.reload} />}
      {emptyNode ?? children(state.data)}
    </>
  );
}

export function Card({
  title,
  icon,
  actions,
  children,
  className,
  refreshing,
}: {
  title: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  refreshing?: boolean;
}) {
  const id = useId();
  return (
    <section className={`card ${className ?? ""}`} aria-labelledby={id}>
      <header className="card-head">
        <h2 id={id} className="card-title">
          {icon && <Icon name={icon} size={16} />}
          {title}
          {refreshing && <Spinner size={12} label="Refreshing" />}
        </h2>
        {actions && <div className="card-actions">{actions}</div>}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

/** A horizontal 0-100 meter. `value` accepts 0-1 or 0-100. */
export function Meter({
  label,
  value,
  max = 100,
  color,
  baseline,
  hint,
  showValue = true,
  swatch = false,
}: {
  label: ReactNode;
  value: number;
  /** The value's scale: 100 (default) or 1. */
  max?: 1 | 100;
  color?: string;
  baseline?: number;
  hint?: string;
  showValue?: boolean;
  /** Show a colour key beside the label (only when several series share a view). */
  swatch?: boolean;
}) {
  const v = toPercent(value, max);
  const b = baseline === undefined ? undefined : toPercent(baseline, max);
  const title = hint ?? (b === undefined ? `${Math.round(v)} / 100` : `${Math.round(v)} / 100 (baseline ${Math.round(b)})`);
  return (
    <div className="meter" title={title}>
      <div className="meter-row">
        <span className="meter-label">
          {swatch && color && <span className="swatch" style={{ background: color }} aria-hidden="true" />}
          {label}
        </span>
        {showValue && (
          <span className="meter-value">
            {Math.round(v)}
            {b !== undefined && <span className="muted"> · base {Math.round(b)}</span>}
          </span>
        )}
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
        aria-label={typeof label === "string" ? label : undefined}
      >
        <div className="meter-fill" style={{ width: `${v}%`, background: color }} />
        {b !== undefined && <div className="meter-baseline" style={{ left: `${b}%` }} aria-hidden="true" />}
      </div>
    </div>
  );
}

export function ImportancePill({ importance }: { importance: Importance | string }) {
  return <span className={`pill pill-imp-${importance}`}>{importance}</span>;
}

export function Pill({ children, tone = "neutral", title }: { children: ReactNode; tone?: string; title?: string }) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {children}
    </span>
  );
}

export type StatusKind = "good" | "warning" | "critical" | "neutral";

/** Status is always icon + label, never colour alone. */
export function StatusBadge({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  const icon: IconName = kind === "good" ? "check" : kind === "neutral" ? "info" : kind === "warning" ? "alert" : "x";
  return (
    <span className={`status status-${kind}`}>
      <Icon name={icon} size={13} strokeWidth={2.4} />
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <label htmlFor={id}>{label}</label>
        {description && <p className="hint">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="modal-inner">
          <header className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
              <Icon name="x" />
            </button>
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** A button that needs a second click to confirm a destructive action. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm?",
  className = "btn btn-danger btn-small",
  ariaLabel,
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className}${armed ? " armed" : ""}`}
      aria-label={armed ? `${ariaLabel ?? "Delete"}: click again to confirm` : ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Toast({ message, onClose, tone = "info" }: { message: string | null; onClose: () => void; tone?: "info" | "error" }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className={`toast toast-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{message}</span>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Dismiss notification">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
