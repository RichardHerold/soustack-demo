/**
 * ServingsControl component
 * 
 * A compact UI for adjusting recipe servings with +/- buttons
 * Shows original vs scaled state
 */

'use client';

import { type CSSProperties } from 'react';

export type ServingsControlProps = {
  /** Current target servings */
  value: number;
  /** Original servings from recipe */
  original: number | null;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Increment callback */
  onIncrement: () => void;
  /** Decrement callback */
  onDecrement: () => void;
  /** Reset to original callback */
  onReset: () => void;
  /** Whether currently scaled */
  isScaled: boolean;
  /** Whether scaling is available */
  disabled?: boolean;
};

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 'var(--text-sm, 14px)',
    color: 'var(--color-text-muted, #666)',
    fontWeight: 500,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'var(--color-bg-muted, #f5f5f5)',
    borderRadius: 'var(--radius-md, 8px)',
    padding: '4px 8px',
  },
  button: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    backgroundColor: 'transparent',
    color: 'var(--color-text, #333)',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    transition: 'background-color 0.15s',
  },
  buttonHover: {
    backgroundColor: 'var(--color-bg-elevated, #fff)',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  value: {
    minWidth: 36,
    textAlign: 'center' as const,
    fontSize: 'var(--text-base, 16px)',
    fontWeight: 600,
    color: 'var(--color-text, #333)',
    fontVariantNumeric: 'tabular-nums',
  },
  valueScaled: {
    color: 'var(--color-primary, #c65d3b)',
  },
  resetButton: {
    marginLeft: 4,
    padding: '4px 8px',
    fontSize: 'var(--text-xs, 12px)',
    color: 'var(--color-text-muted, #666)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm, 4px)',
    transition: 'color 0.15s',
  },
  unit: {
    fontSize: 'var(--text-sm, 14px)',
    color: 'var(--color-text-muted, #666)',
  },
};

export default function ServingsControl({
  value,
  original,
  onChange,
  onIncrement,
  onDecrement,
  onReset,
  isScaled,
  disabled = false,
}: ServingsControlProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    if (!isNaN(num) && num > 0) {
      onChange(num);
    }
  };

  return (
    <div style={styles.container}>
      <span style={styles.label}>Servings</span>
      
      <div style={styles.controls}>
        <button
          type="button"
          onClick={onDecrement}
          disabled={disabled || value <= 1}
          style={{
            ...styles.button,
            ...(disabled || value <= 1 ? styles.buttonDisabled : {}),
          }}
          aria-label="Decrease servings"
        >
          −
        </button>
        
        <input
          type="number"
          min="1"
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          style={{
            ...styles.value,
            ...(isScaled ? styles.valueScaled : {}),
            border: 'none',
            background: 'transparent',
            width: 40,
          }}
          aria-label="Servings count"
        />
        
        <button
          type="button"
          onClick={onIncrement}
          disabled={disabled}
          style={{
            ...styles.button,
            ...(disabled ? styles.buttonDisabled : {}),
          }}
          aria-label="Increase servings"
        >
          +
        </button>
      </div>
      
      {isScaled && original !== null && (
        <button
          type="button"
          onClick={onReset}
          style={styles.resetButton}
          aria-label="Reset to original servings"
        >
          (was {original})
        </button>
      )}
    </div>
  );
}
