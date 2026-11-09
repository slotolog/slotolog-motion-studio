import React from 'react';

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'default'; small?: boolean }> = ({
  variant = 'default',
  small,
  className = '',
  ...rest
}) => {
  const v = {
    primary: 'bg-[#FF8E16] text-black hover:bg-[#ffa340] font-bold',
    ghost: 'bg-transparent hover:bg-white/10 text-neutral-200',
    danger: 'bg-red-600/80 hover:bg-red-500 text-white',
    default: 'bg-[#2b2b2b] hover:bg-[#363636] text-neutral-100 border border-white/10',
  }[variant];
  return (
    <button
      {...rest}
      className={`${v} ${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    />
  );
};

export const Section: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <div className="border-b border-white/5 px-3 py-3">
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#FF8E16]">{title}</h3>
      {right}
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

export const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex items-center gap-2 text-xs text-neutral-300">
    <span className="w-24 shrink-0 text-neutral-400">{label}</span>
    <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
  </label>
);

export const NumInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  digits?: number;
}> = ({ value, onChange, step = 1, min, max, digits = 0 }) => {
  const [text, setText] = React.useState(value.toFixed(digits));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(Number.isFinite(value) ? value.toFixed(digits) : '0');
  }, [value, digits]);
  const commit = (s: string) => {
    let n = parseFloat(s.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
  };
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value.toFixed(digits));
      }}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      className="w-full min-w-0 rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs text-neutral-100 outline-none focus:border-[#FF8E16]"
    />
  );
};

export const TextInput: React.FC<{ value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }> = ({
  value,
  onChange,
  multiline,
  placeholder,
}) =>
  multiline ? (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={2}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs text-neutral-100 outline-none focus:border-[#FF8E16]"
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs text-neutral-100 outline-none focus:border-[#FF8E16]"
    />
  );

export const ColorInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-white/10 bg-transparent" />
    <span className="font-mono text-[10px] text-neutral-400">{value.toUpperCase()}</span>
  </div>
);

export function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded border border-white/10 bg-[#121212] px-2 py-1 text-xs text-neutral-100 outline-none focus:border-[#FF8E16]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const Slider: React.FC<{ value: number; min: number; max: number; step?: number; onChange: (v: number) => void }> = ({
  value,
  min,
  max,
  step = 0.05,
  onChange,
}) => (
  <div className="flex w-full items-center gap-2">
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[#FF8E16]" />
    <span className="w-9 text-right font-mono text-[10px] text-neutral-400">{value.toFixed(step < 1 ? 2 : 0)}</span>
  </div>
);

export const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label?: string }> = ({ value, onChange, label }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex items-center gap-2 text-xs ${value ? 'text-[#FF8E16]' : 'text-neutral-400'}`}
  >
    <span className={`relative inline-block h-4 w-7 rounded-full transition ${value ? 'bg-[#FF8E16]' : 'bg-neutral-600'}`}>
      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${value ? 'left-3.5' : 'left-0.5'}`} />
    </span>
    {label}
  </button>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean | 'xl' }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onPointerDown={onClose}>
    <div
      className={`max-h-[90vh] w-full ${wide === 'xl' ? 'max-w-6xl' : wide ? 'max-w-2xl' : 'max-w-md'} overflow-auto rounded-xl border border-white/10 bg-[#1E1E1E] shadow-2xl`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-white" aria-label="Kapat">
          ✕
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);
