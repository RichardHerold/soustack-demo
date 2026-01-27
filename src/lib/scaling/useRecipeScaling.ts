/**
 * useRecipeScaling hook
 * 
 * Manages scaling state for a recipe, including:
 * - Target servings (user-adjustable)
 * - Scale factor calculation
 * - Scaled ingredient display
 */

import { useState, useMemo, useCallback } from 'react';
import {
  parseServings,
  calculateScaleFactor,
  scaleIngredient,
  formatIngredientDisplay,
  type ScalableIngredient,
} from './scaling';

export type ScaledIngredientItem = {
  id: string;
  original: string;
  scaled: string;
  isScaled: boolean;
  canScale: boolean;
};

export type UseRecipeScalingOptions = {
  /** Original servings string from recipe (e.g., "4 servings") */
  servings: string | undefined | null;
  /** Raw ingredients array from recipe */
  ingredients: unknown[];
  /** Whether scaling is enabled for this recipe */
  scalingEnabled: boolean;
};

export type UseRecipeScalingResult = {
  /** Whether scaling is available for this recipe */
  canScale: boolean;
  /** Original servings count */
  originalServings: number | null;
  /** Current target servings */
  targetServings: number;
  /** Current scale factor */
  scaleFactor: number;
  /** Set target servings */
  setTargetServings: (servings: number) => void;
  /** Increment servings */
  incrementServings: () => void;
  /** Decrement servings */
  decrementServings: () => void;
  /** Reset to original servings */
  resetServings: () => void;
  /** Scaled ingredients for display */
  scaledIngredients: ScaledIngredientItem[];
  /** Whether currently scaled (factor !== 1) */
  isScaled: boolean;
};

/**
 * Parse ingredient item to ScalableIngredient
 */
function parseIngredient(item: unknown): ScalableIngredient | null {
  if (typeof item === 'string') {
    // Try to parse string ingredient
    // Pattern: "2 cups flour" or "1/2 tsp salt"
    const match = String(item).match(/^([\d\s\/]+)?\s*(\w+)?\s+(.+)$/);
    if (match) {
      return {
        quantity: match[1]?.trim(),
        unit: match[2],
        name: match[3],
      };
    }
    return { name: item };
  }

  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    
    // Skip sections
    if ('section' in obj) return null;
    
    if ('name' in obj && typeof obj.name === 'string') {
      return {
        name: obj.name,
        quantity: obj.quantity as number | string | undefined,
        unit: obj.unit as string | undefined,
        scaling: obj.scaling as { mode?: 'proportional' | 'toTaste' | 'fixed' } | undefined,
      };
    }
  }

  return null;
}

/**
 * Hook for managing recipe scaling
 */
export function useRecipeScaling({
  servings,
  ingredients,
  scalingEnabled,
}: UseRecipeScalingOptions): UseRecipeScalingResult {
  // Parse original servings
  const originalServings = useMemo(() => parseServings(servings), [servings]);
  
  // Can scale if: scaling enabled AND we have parseable servings AND at least one scalable ingredient
  const hasScalableIngredients = useMemo(() => {
    return ingredients.some((item) => {
      const parsed = parseIngredient(item);
      if (!parsed) return false;
      const mode = parsed.scaling?.mode;
      return mode !== 'toTaste' && mode !== 'fixed' && parsed.quantity !== undefined;
    });
  }, [ingredients]);
  
  const canScale = scalingEnabled && originalServings !== null && hasScalableIngredients;
  
  // Target servings state
  const [targetServings, setTargetServingsRaw] = useState<number>(
    originalServings ?? 4
  );
  
  // Reset target when original changes
  useMemo(() => {
    if (originalServings !== null) {
      setTargetServingsRaw(originalServings);
    }
  }, [originalServings]);
  
  // Calculate scale factor
  const scaleFactor = useMemo(() => {
    if (!canScale || originalServings === null) return 1;
    return calculateScaleFactor(originalServings, targetServings);
  }, [canScale, originalServings, targetServings]);
  
  const isScaled = scaleFactor !== 1;
  
  // Servings controls
  const setTargetServings = useCallback((value: number) => {
    setTargetServingsRaw(Math.max(1, Math.round(value)));
  }, []);
  
  const incrementServings = useCallback(() => {
    setTargetServingsRaw((prev) => prev + 1);
  }, []);
  
  const decrementServings = useCallback(() => {
    setTargetServingsRaw((prev) => Math.max(1, prev - 1));
  }, []);
  
  const resetServings = useCallback(() => {
    if (originalServings !== null) {
      setTargetServingsRaw(originalServings);
    }
  }, [originalServings]);
  
  // Scale ingredients
  const scaledIngredients = useMemo((): ScaledIngredientItem[] => {
    const results: ScaledIngredientItem[] = [];
    let idx = 0;
    
    for (const item of ingredients) {
      // Handle sections - flatten their items
      if (typeof item === 'object' && item !== null && 'section' in item) {
        const section = item as { section: { name: string; items: unknown[] } };
        for (const sectionItem of section.section.items) {
          const parsed = parseIngredient(sectionItem);
          if (parsed) {
            const id = `ing-${idx++}`;
            const original = formatIngredientDisplay(parsed);
            const { display, scaled } = scaleIngredient(parsed, scaleFactor);
            
            results.push({
              id,
              original,
              scaled: display,
              isScaled: scaled,
              canScale: parsed.quantity !== undefined && 
                parsed.scaling?.mode !== 'toTaste' && 
                parsed.scaling?.mode !== 'fixed',
            });
          }
        }
        continue;
      }
      
      const parsed = parseIngredient(item);
      if (parsed) {
        const id = `ing-${idx++}`;
        const original = formatIngredientDisplay(parsed);
        const { display, scaled } = scaleIngredient(parsed, scaleFactor);
        
        results.push({
          id,
          original,
          scaled: display,
          isScaled: scaled,
          canScale: parsed.quantity !== undefined && 
            parsed.scaling?.mode !== 'toTaste' && 
            parsed.scaling?.mode !== 'fixed',
        });
      } else if (typeof item === 'string') {
        // String ingredient that couldn't be parsed
        const id = `ing-${idx++}`;
        results.push({
          id,
          original: item,
          scaled: item,
          isScaled: false,
          canScale: false,
        });
      }
    }
    
    return results;
  }, [ingredients, scaleFactor]);
  
  return {
    canScale,
    originalServings,
    targetServings,
    scaleFactor,
    setTargetServings,
    incrementServings,
    decrementServings,
    resetServings,
    scaledIngredients,
    isScaled,
  };
}
