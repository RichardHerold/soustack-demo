'use client';

import type { DisplayRecipe } from '@/lib/types';

type RecipeCardProps = {
  recipe: DisplayRecipe;
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const hasMise = recipe.miseEnPlace.length > 0;
  const hasStorage = recipe.storage && Object.keys(recipe.storage).length > 0;
  
  return (
    <article className="recipe-card">
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

      {/* Mise en Place */}
      {hasMise && (
        <section className="recipe-section mise-section">
          <h2>
            <span className="section-icon">✓</span>
            Before You Start
          </h2>
          <ul className="mise-list">
            {recipe.miseEnPlace.map((task, i) => (
              <li key={i} className="mise-item">
                <span className="mise-checkbox" />
                <span className="mise-text">{task}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Two-column: Ingredients + Instructions */}
      <div className="recipe-columns">
        {/* Ingredients */}
        <section className="recipe-section ingredients-section">
          <h2>Ingredients</h2>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="ingredient-item">
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
