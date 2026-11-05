// Small UI building blocks for the side panels.
import React from 'react';

export const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, hint, children, right }) => (
  <section className="border-b border-line px-5 py-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-fg/90">{title}</h3>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
      </div>
      {right}
    </div>
    <div className="space-y-3">{children}</div>
  </section>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft'; size?: 'sm' | 'md' }> = ({
  variant = 'soft',
  size = 'md',
  className = '',
  ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';
  const sizes = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-5 text-sm';
  const variants = {
    primary: 'bg-rose text-ink hover:bg-[#f7bdd0]',
    soft: 'bg-panel-2 text-fg ring-1 ring-line-strong hover:bg-[#2a2428]',
    ghost: 'text-muted hover:text-fg hover:bg-panel-2',
  };
  return <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...props} />;
};

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-ink p-1 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${value === o.value ? 'bg-rose text-ink' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
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
    <div className="mb-1 flex justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-fg/80">{format ? format(value) : value.toFixed(2)}</span>
    </div>
    <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

export const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }> = ({ label, checked, onChange, hint }) => (
  <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left">
    <span>
      <span className="block text-sm text-fg">{label}</span>
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </span>
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-rose' : 'bg-panel-2 ring-1 ring-line-strong'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  </button>
);

export const Select: React.FC<{ label: string; value: string; options: Array<{ value: string; label: string; group?: string }>; onChange: (v: string) => void; fontPreview?: boolean }> = ({
  label,
  value,
  options,
  onChange,
}) => (
  <label className="block">
    <span className="mb-1 block text-xs text-muted">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl bg-ink px-3 text-sm text-fg ring-1 ring-line-strong outline-none focus:ring-rose"
    >
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
    <span className="mb-1 block text-xs text-muted">{label}</span>
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl bg-ink px-3 text-sm text-fg ring-1 ring-line-strong outline-none placeholder:text-muted/60 focus:ring-rose"
    />
  </label>
);

export const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2 rounded-xl bg-ink px-2 py-1.5 ring-1 ring-line">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-7 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
    <span className="text-xs text-muted">{label}</span>
  </label>
);

export const Progress: React.FC<{ value: number; label?: string }> = ({ value, label }) => (
  <div>
    {label ? <div className="mb-1.5 text-xs text-muted">{label}</div> : null}
    <div className="h-2 overflow-hidden rounded-full bg-ink ring-1 ring-line">
      <div className="h-full rounded-full bg-rose transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  </div>
);

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
