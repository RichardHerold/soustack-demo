# Soustack Demo

**Paste a recipe. Get structure.**

A single-purpose demo that converts any recipe (URL or pasted text) into a structured, beautiful format using the [Soustack](https://soustack.org) specification.

Live at [soustack.app](https://soustack.app)

## What it does

1. Paste a recipe URL or text
2. AI extracts structure: ingredients, instructions, timing, mise en place
3. See the recipe rendered in proper mise form
4. Check off prep tasks interactively
5. View or copy the structured JSON

No auth. No database. No save. Just conversion.

## v0.2 Features

- **Interactive mise en place** — Check off prep tasks before cooking
- **Structure indicators** — See which ingredients were parsed, which steps have timing
- **Example recipes** — One-click examples to try without finding your own
- **Recipe/JSON toggle** — Switch between rendered view and raw Soustack JSON
- **Better prompting** — Improved extraction of prep tasks and passive timing

## The Output

- **Mise en Place** — prep tasks to do before cooking (interactive checkboxes!)
- **Structured Ingredients** — quantity, unit, name parsed separately (highlighted when parsed)
- **Timed Instructions** — active vs passive time, completion cues
- **Storage Info** — how long it keeps, if the recipe mentions it

## Quick Start

```bash
# Install dependencies
npm install

# Add your Google AI API key
cp .env.example .env.local
# Edit .env.local with your key

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Get an API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Add it to `.env.local`

## Stack

- Next.js 14 (App Router)
- Google Gemini 2.0 Flash Lite (AI conversion)
- Zero database, zero auth

## Why

This demo exists to prove that Soustack recipes are:

- Pleasant to author
- Understandable to humans  
- Valuable even without full adoption

The spec can be found at [soustack.org](https://soustack.org).

---

Built with Soustack. Structure any recipe.
