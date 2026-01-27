'use client';

import { useState } from 'react';
import Image from 'next/image';
import RecipeCard from '@/components/RecipeCard';
import { normalizeToDisplay } from '@/lib/normalize';
import { EXAMPLE_RECIPES, EXAMPLE_TEXT } from '@/lib/examples';
import type { SoustackLiteRecipe } from '@/lib/types';

export default function Home() {
  const [input, setInput] = useState('');
  const [recipe, setRecipe] = useState<SoustackLiteRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConvert = async (text?: string) => {
    const textToConvert = text || input;
    if (!textToConvert.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToConvert }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Conversion failed');
      }

      const data = await response.json();
      setRecipe(data.recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (type: 'url' | 'text', value?: string) => {
    if (type === 'text') {
      setInput(EXAMPLE_TEXT);
    } else if (value) {
      setInput(value);
      handleConvert(value);
    }
  };

  const handleReset = () => {
    setRecipe(null);
    setInput('');
    setError(null);
    setShowJson(false);
    setCopied(false);
  };

  const handleCopyJson = async () => {
    if (!recipe) return;
    await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleConvert();
    }
  };

  // Result view
  if (recipe) {
    const displayRecipe = normalizeToDisplay(recipe);
    return (
      <main>
        <div className="result-view">
          <div className="result-container">
            <div className="result-actions">
              <button className="btn-back" onClick={handleReset}>
                <span className="arrow">←</span> New Recipe
              </button>

              <div className="result-actions-right">
                {/* View toggle */}
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn ${!showJson ? 'view-toggle-btn--active' : ''}`}
                    onClick={() => setShowJson(false)}
                  >
                    Recipe
                  </button>
                  <button
                    className={`view-toggle-btn ${showJson ? 'view-toggle-btn--active' : ''}`}
                    onClick={() => setShowJson(true)}
                  >
                    JSON
                  </button>
                </div>

                <button
                  className={`btn-copy ${copied ? 'copied' : ''}`}
                  onClick={handleCopyJson}
                >
                  {copied ? '✓ Copied' : 'Copy JSON'}
                </button>
              </div>
            </div>

            <RecipeCard
              recipe={displayRecipe}
              showJson={showJson}
              rawRecipe={recipe}
            />
          </div>
        </div>

        {/* Footer with spec link */}
        <footer className="site-footer">
          <p>
            Powered by the{' '}
            <a href="https://soustack.org" target="_blank" rel="noopener noreferrer">
              Soustack specification
            </a>
            {' '}— the open recipe data standard
          </p>
        </footer>
      </main>
    );
  }

  // Input view
  return (
    <main>
      <div className="input-view">
        <div className="input-container">
          {/* Logo */}
          <div className="logo-header">
            <Image
              src="/logo.png"
              alt="Soustack"
              width={48}
              height={48}
              className="logo-image"
            />
            <span className="logo-text">soustack</span>
          </div>

          {/* Header */}
          <div className="input-header">
            <h1>Paste a recipe. Get structure.</h1>
            <p>
              Drop in a recipe URL or text, and we&apos;ll extract ingredients, 
              instructions, timing, and prep tasks into a clean, structured format.
            </p>
          </div>

          {/* Input card */}
          <div className="input-card">
            <textarea
              className="input-textarea"
              placeholder="Paste a recipe URL or recipe text..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="input-footer">
              <span className="input-hint">⌘+Enter to convert</span>
              <button
                className="btn-convert"
                onClick={() => handleConvert()}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    Convert <span className="arrow">→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          {/* Examples section */}
          <div className="examples-section">
            <span className="examples-label">Try an example:</span>
            <div className="examples-grid">
              {EXAMPLE_RECIPES.map((example) => (
                <button
                  key={example.url}
                  className="example-card"
                  onClick={() => handleExample('url', example.url)}
                  disabled={loading}
                >
                  <span className="example-label">{example.label}</span>
                  <span className="example-desc">{example.source}</span>
                </button>
              ))}
              <button
                className="example-card example-card--text"
                onClick={() => handleExample('text')}
                disabled={loading}
              >
                <span className="example-label">📝 Pasted Text</span>
                <span className="example-desc">Family recipe style</span>
              </button>
            </div>
          </div>

          {/* What you get section */}
          <div className="features-section">
            <h2>What you get</h2>
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-icon">🧅</span>
                <strong>Mise en Place</strong>
                <p>Interactive prep checklist</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <strong>Structured Ingredients</strong>
                <p>Quantity, unit, name parsed</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⏱️</span>
                <strong>Timed Steps</strong>
                <p>Active vs passive time</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">❄️</span>
                <strong>Storage Info</strong>
                <p>How long it keeps</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with spec link */}
      <footer className="site-footer">
        <p>
          Powered by the{' '}
          <a href="https://soustack.org" target="_blank" rel="noopener noreferrer">
            Soustack specification
          </a>
          {' '}— the open recipe data standard
        </p>
      </footer>
    </main>
  );
}
