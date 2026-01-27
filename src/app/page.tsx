'use client';

import { useState } from 'react';
import RecipeCard from '@/components/RecipeCard';
import { normalizeToDisplay } from '@/lib/normalize';
import type { SoustackLiteRecipe } from '@/lib/types';

export default function Home() {
  const [input, setInput] = useState('');
  const [recipe, setRecipe] = useState<SoustackLiteRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleConvert = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // Handle rate limit errors with retry information
        if (res.status === 429 && data.retryAfter) {
          throw new Error(`${data.error} (Retry after ${data.retryAfter}s)`);
        }
        throw new Error(data.error || 'Conversion failed');
      }
      
      setRecipe(data.recipe);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRecipe(null);
    setInput('');
    setError(null);
    setCopied(false);
  };

  const handleCopyJson = async () => {
    if (!recipe) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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
    if (e.key === 'Enter' && e.metaKey) {
      handleConvert();
    }
  };

  // Result view
  if (recipe) {
    const display = normalizeToDisplay(recipe);
    
    return (
      <div className="result-view">
        <div className="result-container">
          <div className="result-actions">
            <button onClick={handleReset} className="btn-back">
              <span className="arrow">←</span>
              Try another
            </button>
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
          
          <RecipeCard recipe={display} />
        </div>
      </div>
    );
  }

  // Input view
  return (
    <div className="input-view">
      <div className="input-container">
        <header className="input-header">
          <h1>Paste a recipe</h1>
          <p>URL or text — we&apos;ll structure it for you</p>
        </header>
        
        <div className="input-card">
          <textarea
            className="input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/chicken-parmesan

or paste the recipe text directly..."
            rows={8}
            autoFocus
          />
          
          {error && (
            <div className="error-message">{error}</div>
          )}
          
          <div className="input-footer">
            <span className="input-hint">⌘ + Enter to convert</span>
            <button 
              onClick={handleConvert} 
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
      </div>
    </div>
  );
}
