/**
 * Tests for scaling utilities
 * Run with: npx vitest run src/lib/scaling/__tests__/scaling.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  parseQuantity,
  formatQuantity,
  roundToSensible,
  scaleIngredient,
  parseServings,
  calculateScaleFactor,
} from '../scaling';

describe('parseQuantity', () => {
  it('parses whole numbers', () => {
    expect(parseQuantity(2)).toBe(2);
    expect(parseQuantity('2')).toBe(2);
    expect(parseQuantity('10')).toBe(10);
  });

  it('parses decimals', () => {
    expect(parseQuantity(2.5)).toBe(2.5);
    expect(parseQuantity('2.5')).toBe(2.5);
    expect(parseQuantity('0.25')).toBe(0.25);
  });

  it('parses simple fractions', () => {
    expect(parseQuantity('1/2')).toBe(0.5);
    expect(parseQuantity('1/4')).toBe(0.25);
    expect(parseQuantity('3/4')).toBe(0.75);
    expect(parseQuantity('1/3')).toBeCloseTo(0.333, 2);
  });

  it('parses mixed fractions', () => {
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('2 1/4')).toBe(2.25);
    expect(parseQuantity('3 3/4')).toBe(3.75);
  });

  it('returns null for invalid input', () => {
    expect(parseQuantity(undefined)).toBe(null);
    expect(parseQuantity('')).toBe(null);
    expect(parseQuantity('abc')).toBe(null);
  });
});

describe('formatQuantity', () => {
  it('formats whole numbers', () => {
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(10)).toBe('10');
  });

  it('formats common fractions with symbols', () => {
    expect(formatQuantity(0.5)).toBe('½');
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(0.75)).toBe('¾');
    expect(formatQuantity(0.333)).toBe('⅓');
  });

  it('formats mixed numbers', () => {
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(2.25)).toBe('2¼');
    expect(formatQuantity(3.75)).toBe('3¾');
  });

  it('formats decimals for non-standard fractions', () => {
    expect(formatQuantity(2.3)).toBe('2.3');
    expect(formatQuantity(1.7)).toBe('1.7');
  });
});

describe('roundToSensible', () => {
  it('rounds teaspoons to 1/4', () => {
    expect(roundToSensible(0.3, 'tsp')).toBe(0.25);
    expect(roundToSensible(0.6, 'tsp')).toBe(0.5);
    expect(roundToSensible(1.1, 'tsp')).toBe(1);
    expect(roundToSensible(1.4, 'tsp')).toBe(1.5);
  });

  it('rounds cups to 1/4', () => {
    expect(roundToSensible(0.3, 'cups')).toBe(0.25);
    expect(roundToSensible(1.6, 'cups')).toBe(1.5);
    expect(roundToSensible(2.1, 'cups')).toBe(2);
  });

  it('rounds grams to 5', () => {
    expect(roundToSensible(103, 'g')).toBe(105);
    expect(roundToSensible(247, 'g')).toBe(245);
    expect(roundToSensible(252, 'g')).toBe(250);
  });

  it('rounds count units to whole numbers', () => {
    expect(roundToSensible(2.3, 'cloves')).toBe(2);
    expect(roundToSensible(2.7, 'cloves')).toBe(3);
    expect(roundToSensible(1.5, 'eggs')).toBe(2);
  });
});

describe('scaleIngredient', () => {
  it('scales proportional ingredients', () => {
    const result = scaleIngredient(
      { name: 'flour', quantity: 2, unit: 'cups' },
      2
    );
    expect(result.display).toBe('4 cups flour');
    expect(result.scaled).toBe(true);
  });

  it('does not scale toTaste ingredients', () => {
    const result = scaleIngredient(
      { name: 'salt', scaling: { mode: 'toTaste' } },
      2
    );
    expect(result.display).toBe('salt (to taste)');
    expect(result.scaled).toBe(false);
  });

  it('does not scale fixed ingredients', () => {
    const result = scaleIngredient(
      { name: 'vanilla extract', quantity: 1, unit: 'tsp', scaling: { mode: 'fixed' } },
      2
    );
    expect(result.display).toBe('1 tsp vanilla extract');
    expect(result.scaled).toBe(false);
  });

  it('handles string quantities', () => {
    const result = scaleIngredient(
      { name: 'butter', quantity: '1/2', unit: 'cup' },
      2
    );
    expect(result.display).toBe('1 cup butter');
    expect(result.scaled).toBe(true);
  });

  it('applies smart rounding', () => {
    const result = scaleIngredient(
      { name: 'flour', quantity: 1, unit: 'cups' },
      1.5
    );
    expect(result.display).toBe('1½ cups flour');
  });

  it('handles ingredients without quantity', () => {
    const result = scaleIngredient(
      { name: 'fresh herbs for garnish' },
      2
    );
    expect(result.display).toBe('fresh herbs for garnish');
    expect(result.scaled).toBe(false);
  });
});

describe('parseServings', () => {
  it('parses simple numbers', () => {
    expect(parseServings('4')).toBe(4);
    expect(parseServings('12')).toBe(12);
  });

  it('parses "X servings" format', () => {
    expect(parseServings('4 servings')).toBe(4);
    expect(parseServings('6 servings')).toBe(6);
  });

  it('parses "Makes X" format', () => {
    expect(parseServings('Makes 24')).toBe(24);
    expect(parseServings('Makes 12 cookies')).toBe(12);
  });

  it('parses "Serves X" format', () => {
    expect(parseServings('Serves 4')).toBe(4);
    expect(parseServings('Serves 6-8')).toBe(6); // Takes first number
  });

  it('returns null for invalid input', () => {
    expect(parseServings(null)).toBe(null);
    expect(parseServings(undefined)).toBe(null);
    expect(parseServings('')).toBe(null);
    expect(parseServings('varies')).toBe(null);
  });
});

describe('calculateScaleFactor', () => {
  it('calculates correct scale factor', () => {
    expect(calculateScaleFactor(4, 8)).toBe(2);
    expect(calculateScaleFactor(4, 2)).toBe(0.5);
    expect(calculateScaleFactor(4, 6)).toBe(1.5);
    expect(calculateScaleFactor(4, 4)).toBe(1);
  });

  it('handles edge cases', () => {
    expect(calculateScaleFactor(0, 4)).toBe(1); // Avoids division by zero
    expect(calculateScaleFactor(4, 1)).toBe(0.25);
  });
});

describe('real-world scaling scenarios', () => {
  it('doubles a cookie recipe', () => {
    const ingredients = [
      { name: 'all-purpose flour', quantity: 2.25, unit: 'cups' },
      { name: 'butter', quantity: 1, unit: 'cup' },
      { name: 'sugar', quantity: '3/4', unit: 'cup' },
      { name: 'eggs', quantity: 2, unit: 'large' },
      { name: 'vanilla extract', quantity: 1, unit: 'tsp', scaling: { mode: 'fixed' as const } },
      { name: 'salt', scaling: { mode: 'toTaste' as const } },
    ];

    const scaled = ingredients.map(ing => scaleIngredient(ing, 2));

    expect(scaled[0].display).toBe('4½ cups all-purpose flour');
    expect(scaled[1].display).toBe('2 cups butter');
    expect(scaled[2].display).toBe('1½ cup sugar');
    expect(scaled[3].display).toBe('4 large eggs');
    expect(scaled[4].display).toBe('1 tsp vanilla extract'); // Fixed, not scaled
    expect(scaled[5].display).toBe('salt (to taste)'); // To taste, not scaled
  });

  it('halves a soup recipe', () => {
    const ingredients = [
      { name: 'chicken broth', quantity: 8, unit: 'cups' },
      { name: 'carrots', quantity: 4, unit: 'medium' },
      { name: 'salt', quantity: 1, unit: 'tsp' },
    ];

    const scaled = ingredients.map(ing => scaleIngredient(ing, 0.5));

    expect(scaled[0].display).toBe('4 cups chicken broth');
    expect(scaled[1].display).toBe('2 medium carrots');
    expect(scaled[2].display).toBe('½ tsp salt');
  });

  it('scales with smart rounding for grams', () => {
    const result = scaleIngredient(
      { name: 'flour', quantity: 250, unit: 'g' },
      1.5
    );
    // 250 * 1.5 = 375, rounds to 375 (nearest 5)
    expect(result.display).toBe('375 g flour');
  });
});
