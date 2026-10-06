import { Crown } from 'lucide-react';

export interface QualityOption<T extends string> {
  value: T;
  label?: string;
  locked?: boolean;
}

interface QualitySelectorProps<T extends string> {
  label: string;
  options: QualityOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  onLocked?: (value: T) => void;
}

export default function QualitySelector<T extends string>({ label, options, value, onSelect, onLocked }: QualitySelectorProps<T>) {
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="quality-label">{label}</span>
      <div className="quality-track">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              id={`quality-${opt.value}`}
              onClick={() => (opt.locked ? onLocked?.(opt.value) : onSelect(opt.value))}
              className={`quality-btn${active ? ' active' : ''}${opt.locked ? ' locked' : ''}`}
              title={opt.locked ? 'Premium only' : undefined}
            >
              {opt.label ?? opt.value}
              {opt.locked && <Crown className="w-3 h-3 text-amber-300" aria-label="Premium" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
