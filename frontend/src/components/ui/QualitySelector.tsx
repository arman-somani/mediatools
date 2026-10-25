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
      <span className="mono-label block mb-2">{label}</span>
      <div className="segmented">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              data-locked={opt.locked || undefined}
              onClick={() => (opt.locked ? onLocked?.(opt.value) : onSelect(opt.value))}
              className="segmented-item"
              title={opt.locked ? 'Premium only' : undefined}
            >
              {opt.label ?? opt.value}
              {opt.locked && <Crown className="w-3 h-3 text-warning" aria-label="Premium" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
