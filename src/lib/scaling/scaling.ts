/**
 * Scaling utilities for Soustack recipes
 * 
 * Handles ingredient quantity multiplication with smart rounding
 * and edge cases like "to taste", "fixed", etc.
 */

export type ScalingMode = 'proportional' | 'toTaste' | 'fixed';

export type ScalableIngredient = {
  name: string;
  quantity?: number | string;
  unit?: string;
  scaling?: {
    mode?: ScalingMode;
  };
};

export type ScaledQuantity = {
  original: number;
  scaled: number;
  display: string;
  unit: string;
};

/**
 * Parse a quantity that might be a number or string (e.g., "1/2", "1 1/2")
 */
export function parseQuantity(qty: number | string | undefined): number | null {
  if (qty === undefined || qty === null || qty === '') return null;
  
  if (typeof qty === 'number') return qty;
  
  const str = String(qty).trim();
  
  // Handle fractions like "1/2", "3/4"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const denom = parseInt(fractionMatch[2], 10);
    return denom !== 0 ? num / denom : null;
  }
  
  // Handle mixed fractions like "1 1/2", "2 3/4"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const denom = parseInt(mixedMatch[3], 10);
    return denom !== 0 ? whole + num / denom : null;
  }
  
  // Handle decimal numbers
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Format a number as a nice display string
 * Uses fractions for common values, otherwise decimals
 */
export function formatQuantity(value: number): string {
  // Handle common fractions
  const fractions: [number, string][] = [
    [0.125, '⅛'],
    [0.25, '¼'],
    [0.333, '⅓'],
    [0.375, '⅜'],
    [0.5, '½'],
    [0.625, '⅝'],
    [0.666, '⅔'],
    [0.75, '¾'],
    [0.875, '⅞'],
  ];
  
  const whole = Math.floor(value);
  const frac = value - whole;
  
  // Check if fractional part matches a common fraction
  for (const [fracValue, fracStr] of fractions) {
    if (Math.abs(frac - fracValue) < 0.02) {
      if (whole === 0) return fracStr;
      return `${whole}${fracStr}`;
    }
  }
  
  // For small numbers, show one decimal
  if (value < 10 && frac !== 0) {
    return value.toFixed(1).replace(/\.0$/, '');
  }
  
  // For larger numbers, round to whole
  return Math.round(value).toString();
}

/**
 * Smart rounding for scaled quantities
 * Rounds to sensible cooking measurements
 */
export function roundToSensible(value: number, unit: string): number {
  const unitLower = unit.toLowerCase();
  
  // For small volume measures (tsp, tbsp), round to nearest 1/4
  if (['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons'].includes(unitLower)) {
    return Math.round(value * 4) / 4;
  }
  
  // For cups, round to nearest 1/4
  if (['cup', 'cups', 'c'].includes(unitLower)) {
    return Math.round(value * 4) / 4;
  }
  
  // For ounces, round to nearest 0.5
  if (['oz', 'ounce', 'ounces'].includes(unitLower)) {
    return Math.round(value * 2) / 2;
  }
  
  // For grams, round to nearest 5
  if (['g', 'gram', 'grams'].includes(unitLower)) {
    return Math.round(value / 5) * 5;
  }
  
  // For ml, round to nearest 5
  if (['ml', 'milliliter', 'milliliters'].includes(unitLower)) {
    return Math.round(value / 5) * 5;
  }
  
  // For count units (pieces, cloves, etc.), round to nearest whole
  if (['piece', 'pieces', 'clove', 'cloves', 'slice', 'slices', 'egg', 'eggs'].includes(unitLower)) {
    return Math.round(value);
  }
  
  // Default: round to 2 decimal places
  return Math.round(value * 100) / 100;
}

/**
 * Scale an ingredient quantity
 */
export function scaleIngredient(
  ingredient: ScalableIngredient,
  scaleFactor: number
): { display: string; scaled: boolean } {
  const mode = ingredient.scaling?.mode || 'proportional';
  
  // Handle non-scaling modes
  if (mode === 'toTaste') {
    return {
      display: formatIngredientDisplay(ingredient),
      scaled: false,
    };
  }
  
  if (mode === 'fixed') {
    return {
      display: formatIngredientDisplay(ingredient),
      scaled: false,
    };
  }
  
  // Parse quantity
  const originalQty = parseQuantity(ingredient.quantity);
  
  if (originalQty === null) {
    // No quantity to scale
    return {
      display: formatIngredientDisplay(ingredient),
      scaled: false,
    };
  }
  
  // Calculate scaled quantity
  const unit = ingredient.unit || '';
  const scaledQty = roundToSensible(originalQty * scaleFactor, unit);
  const formattedQty = formatQuantity(scaledQty);
  
  // Build display string
  const parts: string[] = [formattedQty];
  if (unit) parts.push(unit);
  parts.push(ingredient.name);
  
  return {
    display: parts.join(' '),
    scaled: scaleFactor !== 1,
  };
}

/**
 * Format an ingredient for display (without scaling)
 */
export function formatIngredientDisplay(ingredient: ScalableIngredient): string {
  const parts: string[] = [];
  
  if (ingredient.quantity !== undefined && ingredient.quantity !== '') {
    const qty = parseQuantity(ingredient.quantity);
    if (qty !== null) {
      parts.push(formatQuantity(qty));
    } else {
      parts.push(String(ingredient.quantity));
    }
  }
  
  if (ingredient.unit) {
    parts.push(ingredient.unit);
  }
  
  parts.push(ingredient.name);
  
  const mode = ingredient.scaling?.mode;
  if (mode === 'toTaste') {
    parts.push('(to taste)');
  }
  
  return parts.join(' ');
}

/**
 * Calculate scale factor from original and target servings
 */
export function calculateScaleFactor(
  originalServings: number,
  targetServings: number
): number {
  if (originalServings <= 0) return 1;
  return targetServings / originalServings;
}

/**
 * Parse servings string to number
 * Handles: "4 servings", "Makes 24", "Serves 6-8", "4"
 */
export function parseServings(servings: string | undefined | null): number | null {
  if (!servings) return null;
  
  const str = String(servings).trim();
  
  // Try to extract first number
  const match = str.match(/(\d+)/);
  if (!match) return null;
  
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

/**
 * Format servings for display
 */
export function formatServings(count: number, originalUnit?: string): string {
  const unit = originalUnit || 'servings';
  return `${count} ${unit}`;
}
