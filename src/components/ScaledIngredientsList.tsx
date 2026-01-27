/**
 * ScaledIngredientsList component
 * 
 * Displays ingredients with scaling applied.
 * Shows visual indicators when quantities have been scaled.
 */

'use client';

import { type CSSProperties } from 'react';
import type { ScaledIngredientItem } from './useRecipeScaling';

export type ScaledIngredientsListProps = {
  /** Scaled ingredients from useRecipeScaling */
  ingredients: ScaledIngredientItem[];
  /** Whether recipe is currently scaled */
  isScaled: boolean;
  /** Scale factor for display */
  scaleFactor: number;
  /** Optional: checked ingredient IDs (for cook mode) */
  checkedIds?: Set<string>;
  /** Optional: callback when ingredient is checked/unchecked */
  onToggle?: (id: string) => void;
  /** Show checkboxes for cook mode */
  showCheckboxes?: boolean;
};

const styles: Record<string, CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 0',
    borderBottom: '1px solid var(--color-border-subtle, #f0f0f0)',
    lineHeight: 1.5,
  },
  itemLast: {
    borderBottom: 'none',
  },
  checkbox: {
    marginTop: 2,
    width: 18,
    height: 18,
    accentColor: 'var(--color-primary, #c65d3b)',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 'var(--text-base, 16px)',
    color: 'var(--color-text, #333)',
  },
  textChecked: {
    textDecoration: 'line-through',
    color: 'var(--color-text-muted, #666)',
    opacity: 0.7,
  },
  scaledIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: 8,
    padding: '2px 6px',
    fontSize: 'var(--text-xs, 12px)',
    fontWeight: 500,
    color: 'var(--color-primary, #c65d3b)',
    backgroundColor: 'var(--color-primary-light, #fef0eb)',
    borderRadius: 'var(--radius-sm, 4px)',
  },
  originalQty: {
    fontSize: 'var(--text-xs, 12px)',
    color: 'var(--color-text-subtle, #999)',
    marginTop: 2,
  },
  toTasteBadge: {
    display: 'inline-flex',
    marginLeft: 8,
    padding: '2px 6px',
    fontSize: 'var(--text-xs, 12px)',
    fontWeight: 500,
    color: 'var(--color-text-muted, #666)',
    backgroundColor: 'var(--color-bg-muted, #f5f5f5)',
    borderRadius: 'var(--radius-sm, 4px)',
  },
  emptyState: {
    padding: 16,
    textAlign: 'center' as const,
    color: 'var(--color-text-subtle, #999)',
    fontStyle: 'italic',
  },
};

export default function ScaledIngredientsList({
  ingredients,
  isScaled,
  scaleFactor,
  checkedIds = new Set(),
  onToggle,
  showCheckboxes = false,
}: ScaledIngredientsListProps) {
  if (ingredients.length === 0) {
    return <div style={styles.emptyState}>No ingredients</div>;
  }

  const formatScaleFactor = (factor: number): string => {
    if (factor === 2) return '2×';
    if (factor === 0.5) return '½×';
    if (factor === 1.5) return '1.5×';
    if (factor === 3) return '3×';
    return `${factor.toFixed(1)}×`;
  };

  return (
    <ul style={styles.list}>
      {ingredients.map((ingredient, index) => {
        const isLast = index === ingredients.length - 1;
        const isChecked = checkedIds.has(ingredient.id);
        
        return (
          <li
            key={ingredient.id}
            style={{
              ...styles.item,
              ...(isLast ? styles.itemLast : {}),
            }}
          >
            {showCheckboxes && onToggle && (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(ingredient.id)}
                style={styles.checkbox}
                aria-label={`Mark ${ingredient.original} as gathered`}
              />
            )}
            
            <div style={styles.content}>
              <div
                style={{
                  ...styles.text,
                  ...(isChecked ? styles.textChecked : {}),
                }}
              >
                {ingredient.scaled}
                
                {ingredient.isScaled && (
                  <span style={styles.scaledIndicator}>
                    {formatScaleFactor(scaleFactor)}
                  </span>
                )}
                
                {!ingredient.canScale && ingredient.original.includes('to taste') && (
                  <span style={styles.toTasteBadge}>to taste</span>
                )}
              </div>
              
              {ingredient.isScaled && ingredient.original !== ingredient.scaled && (
                <div style={styles.originalQty}>
                  Originally: {ingredient.original}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
