// UI building blocks: white cards on a light gray canvas, one blue accent.
import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl border border-line bg-bg shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-muted ${className}`}>{children}</div>
);

/** A titled card used for every settings group. */
export const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, hint, children, right }) => (
  <Card className="p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <Eyebrow>{title}</Eyebrow>
        {hint ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{hint}</p> : null}
      </div>
      {right}
    </div>
    <div className="space-y-4">{children}</div>
  </Card>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'dark'; size?: 'sm' | 'md' | 'lg' }> = ({
  variant = 'soft',
  size = 'md',
  className = '',
  ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-ring/60';
  const sizes = size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm';
  const variants = {
    primary: 'bg-brand text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-600',
    dark: 'bg-fg text-white hover:bg-fg-2',
    soft: 'border border-line-strong bg-bg text-fg-2 hover:bg-subtle',
    ghost: 'text-muted hover:bg-subtle hover:text-fg',
  };
  return <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...props} />;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; style?: React.CSSProperties }>;
  onChange: (v: T) => void;
  renderLabel?: (o: { value: T; label: string }) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-subtle p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={o.style}
          className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
            value === o.value ? 'bg-bg text-brand shadow-[0_1px_3px_rgba(16,24,40,0.12)] ring-1 ring-line' : 'text-muted hover:text-fg'
          }`}
        >
          {renderLabel ? renderLabel(o) : o.label}
        </button>
      ))}
    </div>
  );
}

export const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}) => (
  <label className="block">
    <div className="mb-1.5 flex justify-between text-xs">
      <span className="font-medium text-fg-2">{label}</span>
      <span className="tabular-nums text-muted">{format ? format(value) : value.toFixed(2)}</span>
    </div>
    <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

export const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }> = ({ label, checked, onChange, hint }) => (
  <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left">
    {label || hint ? (
      <span>
        {label ? <span className="block text-sm font-medium text-fg">{label}</span> : null}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    ) : null}
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line-strong'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  </button>
);

const fieldClass = 'h-10 w-full rounded-xl border border-line-strong bg-bg px-3 text-sm text-fg outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand-ring/40';

export const Select: React.FC<{ label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-fg-2">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

export const TextInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-fg-2">{label}</span>
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
  </label>
);

export const TextArea: React.FC<{ label?: string; value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean; rows?: number }> = ({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  rows = 4,
}) => (
  <label className="block">
    {label ? <span className="mb-1.5 block text-xs font-medium text-fg-2">{label}</span> : null}
    <textarea
      rows={rows}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full rounded-xl border border-line-strong bg-bg p-3 text-sm leading-relaxed text-fg outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand-ring/40"
    />
  </label>
);

export const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line-strong bg-bg px-2.5 py-2 transition hover:bg-subtle">
    <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: value }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </span>
    <span className="text-xs font-medium text-fg-2">{label}</span>
    <span className="ml-auto font-mono text-[10px] uppercase text-muted">{value}</span>
  </label>
);

export const Progress: React.FC<{ value: number; label?: string }> = ({ value, label }) => (
  <div>
    {label ? <div className="mb-1.5 text-xs font-medium text-fg-2">{label}</div> : null}
    <div className="h-2 overflow-hidden rounded-full bg-subtle">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; tone?: 'brand' | 'gray' }> = ({ children, tone = 'gray' }) => (
  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone === 'brand' ? 'bg-brand-soft text-brand' : 'bg-subtle text-muted'}`}>
    {children}
  </span>
);

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
