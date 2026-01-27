'use client';

import { useState } from 'react';
import type { DisplayRecipe } from '@/lib/types';

type RecipeCardProps = {
  recipe: DisplayRecipe;
  showJson: boolean;
  rawRecipe: object;
};

export default function RecipeCard({ recipe, showJson, rawRecipe }: RecipeCardProps) {
  const [checkedMise, setCheckedMise] = useState<Set<number>>(new Set());
  
  const hasMise = recipe.miseEnPlace.length > 0;
  const hasStorage = recipe.storage && Object.keys(recipe.storage).length > 0;
  
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
          {recipe.servings && (
            <span className="meta-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {recipe.servings}
            </span>
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
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className={`ingredient-item ${ing.isStructured ? 'ingredient-item--structured' : ''}`}>
                {ing.isStructured ? (
                  <>
                    {ing.quantity && (
                      <span className="ingredient-qty">{ing.quantity}</span>
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
