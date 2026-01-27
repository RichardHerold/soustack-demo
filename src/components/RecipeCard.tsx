'use client';

import { useState, useMemo, useCallback } from 'react';
import type { DisplayRecipe, SoustackRecipe, Ingredient } from '@/lib/types';

type RecipeCardProps = {
  recipe: DisplayRecipe;
  showJson: boolean;
  rawRecipe: SoustackRecipe;
};

// ============================================================================
// Scaling Utilities (inline to keep it simple)
// ============================================================================

type ScalingMode = 'toTaste' | 'linear' | 'fixed';

function parseQuantity(qty: number | string | undefined): number | null {
  if (qty === undefined || qty === null || qty === '') return null;
  if (typeof qty === 'number') return qty;

  const str = String(qty).trim();

  // Handle fractions like "1/2"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }

  // Handle mixed fractions like "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

function formatQuantity(value: number): string {
  const fractions: [number, string][] = [
    [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'],
    [0.5, '½'], [0.625, '⅝'], [0.666, '⅔'], [0.75, '¾'], [0.875, '⅞'],
  ];

  const whole = Math.floor(value);
  const frac = value - whole;

  for (const [fracValue, fracStr] of fractions) {
    if (Math.abs(frac - fracValue) < 0.02) {
      return whole === 0 ? fracStr : `${whole}${fracStr}`;
    }
  }

  if (value < 10 && frac !== 0) {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  return Math.round(value).toString();
}

function roundToSensible(value: number, unit: string): number {
  const u = unit.toLowerCase();

  if (['tsp', 'teaspoon', 'tbsp', 'tablespoon', 'cup', 'cups'].includes(u)) {
    return Math.round(value * 4) / 4;
  }
  if (['oz', 'ounce', 'ounces'].includes(u)) {
    return Math.round(value * 2) / 2;
  }
  if (['g', 'gram', 'grams', 'ml', 'milliliter'].includes(u)) {
    return Math.round(value / 5) * 5;
  }
  if (['clove', 'cloves', 'piece', 'pieces', 'egg', 'eggs', 'slice', 'slices'].includes(u)) {
    return Math.round(value);
  }

  return Math.round(value * 100) / 100;
}

function parseServings(servings: string | undefined): number | null {
  if (!servings) return null;
  const match = servings.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// ============================================================================
// Component
// ============================================================================

export default function RecipeCard({ recipe, showJson, rawRecipe }: RecipeCardProps) {
  const [checkedMise, setCheckedMise] = useState<Set<number>>(new Set());
  const [targetServings, setTargetServings] = useState<number | null>(null);

  const hasMise = recipe.miseEnPlace.length > 0;
  const hasStorage = recipe.storage && Object.keys(recipe.storage).length > 0;

  // Scaling setup
  const originalServings = useMemo(() => parseServings(recipe.servings), [recipe.servings]);

  const hasScalableIngredients = useMemo(() => {
    return rawRecipe.ingredients.some((ing: Ingredient) => {
      if (typeof ing === 'string') return false;
      const mode = ing.scaling?.mode;
      if (mode === 'toTaste' || mode === 'fixed') return false;
      // Has quantity in new or legacy format
      return ing.quantity !== undefined;
    });
  }, [rawRecipe.ingredients]);

  const canScale = originalServings !== null && hasScalableIngredients;

  // Initialize target servings when we can scale
  const effectiveTargetServings = targetServings ?? originalServings ?? 4;

  const scaleFactor = useMemo(() => {
    if (!canScale || originalServings === null) return 1;
    return effectiveTargetServings / originalServings;
  }, [canScale, originalServings, effectiveTargetServings]);

  const isScaled = scaleFactor !== 1;

  // Scale ingredients
  const scaledIngredients = useMemo(() => {
    return recipe.ingredients.map((displayIng, idx) => {
      const rawIng = rawRecipe.ingredients[idx];

      // Base result shape - always include all fields
      const baseResult = {
        ...displayIng,
        scaledQty: null as string | null,
        originalQty: displayIng.quantity || null,
        isScaled: false,
      };

      // Can't scale string ingredients or non-structured
      if (typeof rawIng === 'string' || !displayIng.isStructured) {
        return baseResult;
      }

      // Check scaling mode
      const mode: ScalingMode | undefined = rawIng.scaling?.mode;
      if (mode === 'toTaste' || mode === 'fixed') {
        return baseResult;
      }

      // Get original quantity - handle both new and legacy formats
      let originalQtyNum: number | null = null;
      let unit = displayIng.unit || '';

      if (rawIng.quantity && typeof rawIng.quantity === 'object' && 'amount' in rawIng.quantity) {
        // New format: { amount, unit }
        originalQtyNum = rawIng.quantity.amount;
        unit = rawIng.quantity.unit || unit;
      } else if (displayIng.quantity) {
        // Legacy: parse from display
        originalQtyNum = parseQuantity(displayIng.quantity);
      }

      if (originalQtyNum === null) {
        return baseResult;
      }

      // Calculate scaled quantity
      const scaledValue = roundToSensible(originalQtyNum * scaleFactor, unit);
      const scaledQty = formatQuantity(scaledValue);

      return {
        ...displayIng,
        scaledQty,
        originalQty: displayIng.quantity || null,
        isScaled: scaleFactor !== 1,
        unit,
      };
    });
  }, [recipe.ingredients, rawRecipe.ingredients, scaleFactor]);

  const toggleMise = (index: number) => {
    setCheckedMise(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const miseProgress = hasMise
    ? Math.round((checkedMise.size / recipe.miseEnPlace.length) * 100)
    : 0;

  const handleIncrement = useCallback(() => {
    setTargetServings(prev => (prev ?? originalServings ?? 4) + 1);
  }, [originalServings]);

  const handleDecrement = useCallback(() => {
    setTargetServings(prev => Math.max(1, (prev ?? originalServings ?? 4) - 1));
  }, [originalServings]);

  const handleReset = useCallback(() => {
    setTargetServings(null);
  }, []);

  // JSON view
  if (showJson) {
    return (
      <article className="recipe-card json-view">
        <header className="json-header">
          <h2>Soustack JSON</h2>
          <p className="json-hint">This is the structured data extracted from your recipe</p>
        </header>
        <pre className="json-content">
          <code>{JSON.stringify(rawRecipe, null, 2)}</code>
        </pre>
      </article>
    );
  }

  return (
    <article className="recipe-card">
      {/* Structure Stats Banner */}
      <div className="structure-banner">
        <span className="structure-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Structured by Soustack
        </span>
        <div className="structure-stats">
          {recipe.stats.structuredIngredients > 0 && (
            <span className="stat-item" title="Ingredients parsed into quantity, unit, and name">
              {recipe.stats.structuredIngredients}/{recipe.stats.totalIngredients} ingredients parsed
            </span>
          )}
          {recipe.stats.timedSteps > 0 && (
            <span className="stat-item" title="Steps with timing extracted">
              {recipe.stats.timedSteps} timed steps
            </span>
          )}
          {recipe.stats.hasMise && (
            <span className="stat-item" title="Prep tasks identified">
              mise en place ✓
            </span>
          )}
          {recipe.stats.hasStorage && (
            <span className="stat-item" title="Storage info found">
              storage ✓
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="recipe-header">
        <h1>{recipe.title}</h1>
        {recipe.description && (
          <p className="recipe-description">{recipe.description}</p>
        )}
        <div className="recipe-meta">
          {/* Servings with scaling control */}
          {recipe.servings && (
            <div className="meta-item servings-control">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>

              {canScale ? (
                <div className="servings-adjuster">
                  <button
                    onClick={handleDecrement}
                    disabled={effectiveTargetServings <= 1}
                    className="servings-btn"
                    aria-label="Decrease servings"
                  >
                    −
                  </button>
                  <span className={`servings-value ${isScaled ? 'servings-value--scaled' : ''}`}>
                    {effectiveTargetServings}
                  </span>
                  <button
                    onClick={handleIncrement}
                    className="servings-btn"
                    aria-label="Increase servings"
                  >
                    +
                  </button>
                  <span className="servings-unit">servings</span>
                  {isScaled && (
                    <button onClick={handleReset} className="servings-reset">
                      (was {originalServings})
                    </button>
                  )}
                </div>
              ) : (
                <span>{recipe.servings}</span>
              )}
            </div>
          )}
          {recipe.totalTime && (
            <span className="meta-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {recipe.totalTime}
            </span>
          )}
        </div>
      </header>

      {/* Scaling indicator */}
      {isScaled && (
        <div className="scaling-banner">
          <span className="scaling-icon">⚖</span>
          <span>
            Scaled to <strong>{effectiveTargetServings} servings</strong>
            <span className="scaling-factor">({scaleFactor.toFixed(1)}×)</span>
          </span>
        </div>
      )}

      {/* Mise en Place - Interactive! */}
      {hasMise && (
        <section className="recipe-section mise-section">
          <div className="mise-header">
            <h2>
              <span className="section-icon">✓</span>
              Before You Start
            </h2>
            {miseProgress > 0 && (
              <span className="mise-progress">
                {miseProgress}% ready
              </span>
            )}
          </div>
          <p className="mise-hint">Check off tasks as you prep — this is what makes cooking smoother</p>
          <ul className="mise-list">
            {recipe.miseEnPlace.map((task, i) => (
              <li
                key={i}
                className={`mise-item ${checkedMise.has(i) ? 'mise-item--checked' : ''}`}
                onClick={() => toggleMise(i)}
              >
                <span className={`mise-checkbox ${checkedMise.has(i) ? 'mise-checkbox--checked' : ''}`}>
                  {checkedMise.has(i) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="mise-text">{task}</span>
              </li>
            ))}
          </ul>
          {miseProgress === 100 && (
            <div className="mise-complete">
              🎉 Ready to cook!
            </div>
          )}
        </section>
      )}

      {/* Two-column: Ingredients + Instructions */}
      <div className="recipe-columns">
        {/* Ingredients */}
        <section className="recipe-section ingredients-section">
          <h2>Ingredients</h2>
          <ul className="ingredients-list">
            {scaledIngredients.map((ing) => (
              <li key={ing.id} className={`ingredient-item ${ing.isStructured ? 'ingredient-item--structured' : ''} ${ing.isScaled ? 'ingredient-item--scaled' : ''}`}>
                {ing.isStructured ? (
                  <>
                    {(ing.scaledQty || ing.quantity) && (
                      <span className={`ingredient-qty ${ing.isScaled ? 'ingredient-qty--scaled' : ''}`}>
                        {ing.scaledQty || ing.quantity}
                      </span>
                    )}
                    {ing.unit && (
                      <span className="ingredient-unit">{ing.unit}</span>
                    )}
                    <span className="ingredient-name">{ing.name}</span>
                    {ing.toTaste && (
                      <span className="ingredient-note">to taste</span>
                    )}
                    {ing.notes && (
                      <span className="ingredient-note">{ing.notes}</span>
                    )}
                    {ing.isScaled && ing.originalQty && (
                      <span className="ingredient-original">
                        was {ing.originalQty}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="ingredient-text">{ing.text}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Instructions */}
        <section className="recipe-section instructions-section">
          <h2>Instructions</h2>
          <ol className="instructions-list">
            {recipe.instructions.map((step, i) => (
              <li key={step.id} className="instruction-item">
                <span className="step-number">{i + 1}</span>
                <div className="step-content">
                  <p className="step-text">{step.text}</p>
                  {step.timing && (
                    <span className={`timing-badge ${step.isPassive ? 'timing-passive' : ''}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {step.timing}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Storage */}
      {hasStorage && (
        <section className="recipe-section storage-section">
          <h2>
            <span className="section-icon">❄</span>
            Storage
          </h2>
          <div className="storage-grid">
            {recipe.storage?.refrigerated && (
              <div className="storage-item">
                <span className="storage-label">Refrigerated</span>
                <span className="storage-value">{recipe.storage.refrigerated}</span>
              </div>
            )}
            {recipe.storage?.frozen && (
              <div className="storage-item">
                <span className="storage-label">Frozen</span>
                <span className="storage-value">{recipe.storage.frozen}</span>
              </div>
            )}
            {recipe.storage?.roomTemp && (
              <div className="storage-item">
                <span className="storage-label">Room Temp</span>
                <span className="storage-value">{recipe.storage.roomTemp}</span>
              </div>
            )}
          </div>
        </section>
      )}
    </article>
  );
}