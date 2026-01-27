'use client';

import { useState } from 'react';
import Image from 'next/image';
import RecipeCard from '@/components/RecipeCard';
import { normalizeToDisplay } from '@/lib/normalize';
import { EXAMPLE_RECIPES, EXAMPLE_TEXT } from '@/lib/examples';
import type { SoustackRecipe } from '@/lib/types';

export default function Home() {
  const [input, setInput] = useState('');
  const [recipe, setRecipe] = useState<SoustackRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

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
      setInput(textToConvert);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (type: 'url' | 'text', value?: string) => {
    if (type === 'text') {
      setInput(EXAMPLE_TEXT);
      handleConvert(EXAMPLE_TEXT);
    } else if (value) {
      setInput(value);
      handleConvert(value);
    }
  };

  const handleReset = () => {
    setRecipe(null);
    setInput('');
    setError(null);
    setCopied(false);
    setShowJson(false);
  };

  const handleCopyJson = async () => {
    if (!recipe) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = JSON.stringify(recipe, null, 2);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleConvert();
    }
  };

  // Result view
  if (recipe) {
    const display = normalizeToDisplay(recipe);
    
    return (
      <div className="result-view">
        <div className="logo-header">
          <Image src="/logo.png" alt="Soustack" width={32} height={32} className="logo-image" />
          <span className="logo-text">Soustack</span>
        </div>
        <div className="result-container">
          <div className="result-actions">
            <button onClick={handleReset} className="btn-back">
              <span className="arrow">←</span>
              Try another
            </button>
            
            <div className="result-actions-right">
              {/* View toggle */}
              <div className="view-toggle">
                <button 
                  onClick={() => setShowJson(false)}
                  className={`view-toggle-btn ${!showJson ? 'view-toggle-btn--active' : ''}`}
                >
                  Recipe
                </button>
                <button 
                  onClick={() => setShowJson(true)}
                  className={`view-toggle-btn ${showJson ? 'view-toggle-btn--active' : ''}`}
                >
                  JSON
                </button>
              </div>
              
              <button 
                onClick={handleCopyJson} 
                className={`btn-copy ${copied ? 'copied' : ''}`}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy JSON
                  </>
                )}
              </button>
            </div>
          </div>
          
          <RecipeCard recipe={display} showJson={showJson} rawRecipe={recipe} />
        </div>
      </div>
    );
  }

  // Input view
  return (
    <div className="input-view">
      <div className="logo-header">
        <Image src="/logo.png" alt="Soustack" width={32} height={32} className="logo-image" />
        <span className="logo-text">Soustack</span>
      </div>
      <div className="input-container">
        <header className="input-header">
          <h1>Paste a recipe</h1>
          <p>URL or text — we&apos;ll extract the structure</p>
        </header>
        
        <div className="input-card">
          <textarea
            className="input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://cooking.nytimes.com/recipes/...

or paste the full recipe text..."
            rows={8}
            autoFocus
            disabled={loading}
          />
          
          {error && (
            <div className="error-message">{error}</div>
          )}
          
          <div className="input-footer">
            <span className="input-hint">⌘ + Enter to convert</span>
            <button 
              onClick={() => handleConvert()} 
              disabled={loading || !input.trim()}
              className="btn-convert"
            >
              {loading ? (
                <>
                  <span className="loading-spinner" />
                  Converting...
                </>
              ) : (
                <>
                  Convert
                  <span className="arrow">→</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Examples section */}
        <div className="examples-section">
          <p className="examples-label">Try an example</p>
          <div className="examples-grid">
            {EXAMPLE_RECIPES.slice(0, 3).map((example) => (
              <button
                key={example.id}
                onClick={() => handleExample('url', example.url)}
                className="example-card"
                disabled={loading}
              >
                <span className="example-label">{example.label}</span>
                <span className="example-desc">{example.description}</span>
              </button>
            ))}
            <button
              onClick={() => handleExample('text')}
              className="example-card example-card--text"
              disabled={loading}
            >
              <span className="example-label">Pasted Text</span>
              <span className="example-desc">Classic beef tacos recipe</span>
            </button>
          </div>
        </div>
        
        {/* What you get section */}
        <div className="features-section">
          <h2>What you get</h2>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Mise en Place</strong>
                <p>Prep tasks extracted so you know what to do before cooking</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚖</span>
              <div>
                <strong>Parsed Ingredients</strong>
                <p>Quantities, units, and names separated for scaling</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⏱</span>
              <div>
                <strong>Timing Extracted</strong>
                <p>Active vs passive time, so you can plan ahead</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">❄</span>
              <div>
                <strong>Storage Info</strong>
                <p>How long it keeps, if the recipe mentions it</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
