import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SoustackRecipe } from '@/lib/types';

// ============================================================================
// Configuration
// ============================================================================

function getGeminiModel() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not defined');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// ============================================================================
// Prompt
// ============================================================================

function createConvertPrompt(text: string): string {
  return `You are a recipe parser. Convert this recipe into structured JSON.

INPUT:
${text}

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "Recipe Title",
  "description": "Brief description",
  "servings": "4 servings",
  "totalTime": "45 minutes",
  "miseEnPlace": [
    { "text": "Prep task before cooking (e.g., 'Mince the garlic', 'Preheat oven to 400°F')" }
  ],
  "ingredients": [
    { "name": "all-purpose flour", "quantity": 2.5, "unit": "cups", "prep": "sifted" },
    { "name": "butter", "quantity": 1, "unit": "cup", "notes": "room temperature" },
    { "name": "salt", "toTaste": true },
    { "name": "pepper", "toTaste": true }
  ],
  "instructions": [
    { "text": "Mix dry ingredients", "timing": { "minutes": 5, "activity": "active" } },
    { "text": "Bake until golden", "timing": { "minMinutes": 25, "maxMinutes": 30, "activity": "passive", "completionCue": "until golden brown" } },
    { "text": "Let cool", "timing": { "minutes": 10, "activity": "passive" } }
  ],
  "storage": {
    "refrigerated": "3-4 days",
    "frozen": "up to 3 months"
  }
}

RULES:
1. Parse quantities as numbers (2.5, not "2 1/2")
2. Extract prep verbs into "prep" field: diced, minced, chopped, sliced, softened, melted, sifted, etc.
3. Extract temperature notes into "notes": room temperature, cold, chilled
4. "to taste" ingredients: { "name": "salt", "toTaste": true } - never include "to taste" in name
5. "salt and pepper to taste" → split into two ingredients, each with toTaste: true
6. Timing with ranges: { "minMinutes": 25, "maxMinutes": 30 }
7. Activity types: "active" (hands-on: sauté, stir, mix) vs "passive" (waiting: bake, rest, chill)
8. miseEnPlace: ALL prep before cooking - preheat, chop, measure, marinate, bring to room temp
9. storage: only if recipe mentions shelf life
10. Return ONLY valid JSON, no explanation or markdown fences`;
}

// ============================================================================
// URL Fetching
// ============================================================================

async function maybeFetchUrl(text: string): Promise<string> {
  const trimmed = text.trim();
  
  if (!trimmed.match(/^https?:\/\/[^\s]+$/i)) {
    return trimmed;
  }
  
  try {
    const res = await fetch(trimmed, {
      headers: {
        'User-Agent': 'Soustack/1.0 (Recipe Converter)',
        'Accept': 'text/html,text/plain',
      },
      redirect: 'follow',
    });
    
    if (!res.ok) return trimmed;
    
    const html = await res.text();
    
    // Try JSON-LD first
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch;
    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(jsonLdMatch[1].trim());
        
        const isRecipe = (item: unknown): item is Record<string, unknown> => {
          if (!item || typeof item !== 'object') return false;
          const obj = item as Record<string, unknown>;
          const type = obj['@type'];
          if (Array.isArray(type)) return type.includes('Recipe');
          return type === 'Recipe';
        };
        
        let recipe: Record<string, unknown> | null = null;
        if (Array.isArray(data)) {
          recipe = data.find(isRecipe) || null;
        } else if (data['@graph'] && Array.isArray(data['@graph'])) {
          recipe = data['@graph'].find(isRecipe) || null;
        } else if (isRecipe(data)) {
          recipe = data;
        }
        
        if (recipe) {
          const parts: string[] = [];
          if (recipe.name) parts.push(String(recipe.name));
          if (recipe.description) parts.push(String(recipe.description));
          if (recipe.recipeYield) parts.push(`Serves: ${recipe.recipeYield}`);
          if (recipe.totalTime) parts.push(`Total time: ${formatIsoDuration(String(recipe.totalTime))}`);
          if (recipe.prepTime) parts.push(`Prep time: ${formatIsoDuration(String(recipe.prepTime))}`);
          if (recipe.cookTime) parts.push(`Cook time: ${formatIsoDuration(String(recipe.cookTime))}`);
          
          if (Array.isArray(recipe.recipeIngredient)) {
            parts.push('\nIngredients:');
            for (const ing of recipe.recipeIngredient) {
              parts.push(`- ${ing}`);
            }
          }
          
          if (Array.isArray(recipe.recipeInstructions)) {
            parts.push('\nInstructions:');
            recipe.recipeInstructions.forEach((inst: unknown, i: number) => {
              const text = typeof inst === 'string' ? inst : 
                (inst as Record<string, unknown>)?.text || 
                (inst as Record<string, unknown>)?.name || '';
              if (text) parts.push(`${i + 1}. ${text}`);
            });
          }
          
          return parts.join('\n').slice(0, 8000);
        }
      } catch {
        continue;
      }
    }
    
    // Fallback: strip HTML
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent.slice(0, 8000);
  } catch {
    return trimmed;
  }
}

function formatIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? parseInt(match[1]) : 0;
  const m = match[2] ? parseInt(match[2]) : 0;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hour${h > 1 ? 's' : ''}`;
  if (m) return `${m} minutes`;
  return iso;
}

// ============================================================================
// Transform to Soustack
// ============================================================================

function transformToSoustackRecipe(
  parsed: Record<string, unknown>,
  originalText: string
): SoustackRecipe {
  const now = new Date().toISOString();
  
  // Parse yield
  const yield_ = parseYield(parsed.servings as string | undefined);
  
  // Parse time
  const time = parseTime(parsed.totalTime as string | undefined);
  
  // Transform ingredients with IDs
  const ingredients = transformIngredients(
    Array.isArray(parsed.ingredients) ? parsed.ingredients : []
  );
  
  // Transform instructions with IDs
  const instructions = transformInstructions(
    Array.isArray(parsed.instructions) ? parsed.instructions : []
  );
  
  // Transform mise en place
  const miseEnPlace = Array.isArray(parsed.miseEnPlace) && parsed.miseEnPlace.length > 0
    ? parsed.miseEnPlace.map((item: unknown) => 
        typeof item === 'string' ? { text: item } : item as { text: string }
      )
    : undefined;
  
  // Transform storage
  const storage = transformStorage(parsed.storage as Record<string, string> | undefined);
  
  // Infer stacks
  const stacks = inferStacks(ingredients, instructions, miseEnPlace, storage);
  
  // Determine profile: base if yield OR time, else lite
  const profile = (yield_ || time) ? 'base' : 'lite';
  
  const recipe: SoustackRecipe = {
    $schema: 'https://spec.soustack.org/soustack.schema.json',
    profile,
    stacks,
    name: String(parsed.name || 'Untitled Recipe'),
    ingredients,
    instructions,
    'x-soustack': {
      source: {
        text: originalText.slice(0, 500),
        convertedAt: now,
        converter: 'gemini-2.0-flash',
      },
    },
  };
  
  // Add optional fields
  if (parsed.description) recipe.description = String(parsed.description);
  if (yield_) recipe.yield = yield_;
  if (time) recipe.time = { total: time };
  if (miseEnPlace) recipe.miseEnPlace = miseEnPlace;
  if (storage) recipe.storage = storage;
  
  return recipe;
}

function parseYield(servings?: string): { amount: number; unit: string } | undefined {
  if (!servings) return undefined;
  
  // "4 servings", "Makes 24 cookies", "Serves 6-8"
  const match = servings.match(/(\d+)(?:-(\d+))?\s*(.+)?/i);
  if (!match) return undefined;
  
  const min = parseInt(match[1]);
  const max = match[2] ? parseInt(match[2]) : min;
  const amount = (min + max) / 2;
  const unit = match[3]?.trim().toLowerCase() || 'servings';
  
  return { amount, unit };
}

function parseTime(timeStr?: string): { minutes: number } | undefined {
  if (!timeStr) return undefined;
  
  let total = 0;
  
  const hourMatch = timeStr.match(/(\d+)\s*(?:hours?|hrs?|h)/i);
  if (hourMatch) total += parseInt(hourMatch[1]) * 60;
  
  const minMatch = timeStr.match(/(\d+)\s*(?:minutes?|mins?|m)(?!\w)/i);
  if (minMatch) total += parseInt(minMatch[1]);
  
  return total > 0 ? { minutes: total } : undefined;
}

function transformIngredients(ingredients: unknown[]): SoustackRecipe['ingredients'] {
  let id = 1;
  
  return ingredients.flatMap((ing): SoustackRecipe['ingredients'] => {
    if (typeof ing === 'string') {
      // Check for "to taste"
      if (/to\s*taste/i.test(ing)) {
        return splitToTaste(ing, () => `ing-${id++}`);
      }
      return [ing];
    }
    
    if (typeof ing !== 'object' || ing === null) return [];
    
    const obj = ing as Record<string, unknown>;
    const name = String(obj.name || '');
    
    // Handle "X and Y to taste"
    if (/\s+and\s+.+to\s*taste$/i.test(name)) {
      return splitToTaste(name, () => `ing-${id++}`);
    }
    
    // Handle single "X to taste" in name
    if (/to\s*taste/i.test(name)) {
      const cleanName = name.replace(/\s*,?\s*to\s*taste\s*/gi, '').trim();
      return [{
        id: `ing-${id++}`,
        name: cleanName,
        scaling: { mode: 'toTaste' as const },
      }];
    }
    
    // Build structured ingredient
    const result: Record<string, unknown> = {
      id: `ing-${id++}`,
      name,
    };
    
    // Add quantity
    if (typeof obj.quantity === 'number' && obj.unit) {
      result.quantity = { amount: obj.quantity, unit: String(obj.unit) };
    }
    
    // Add prep
    if (obj.prep) result.prep = String(obj.prep);
    
    // Add notes (but not if it's just "to taste")
    if (obj.notes && !/^to\s*taste$/i.test(String(obj.notes))) {
      result.notes = String(obj.notes);
    }
    
    // Handle toTaste flag
    if (obj.toTaste) {
      result.scaling = { mode: 'toTaste' };
    }
    
    return [result as SoustackRecipe['ingredients'][number]];
  });
}

function splitToTaste(str: string, genId: () => string): SoustackRecipe['ingredients'] {
  // "salt and pepper to taste"
  const andMatch = str.match(/^(.+?)\s+and\s+(.+?)\s+to\s*taste$/i);
  if (andMatch) {
    return [
      { id: genId(), name: andMatch[1].trim(), scaling: { mode: 'toTaste' as const } },
      { id: genId(), name: andMatch[2].trim(), scaling: { mode: 'toTaste' as const } },
    ];
  }
  
  // "X to taste"
  const match = str.match(/^(.+?)\s+to\s*taste$/i);
  if (match) {
    return [{ id: genId(), name: match[1].trim(), scaling: { mode: 'toTaste' as const } }];
  }
  
  return [str];
}

function transformInstructions(instructions: unknown[]): SoustackRecipe['instructions'] {
  let id = 1;
  
  return instructions.map((inst): SoustackRecipe['instructions'][number] => {
    if (typeof inst === 'string') return inst;
    if (typeof inst !== 'object' || inst === null) return String(inst);
    
    const obj = inst as Record<string, unknown>;
    const result: Record<string, unknown> = {
      id: `step-${id++}`,
      text: String(obj.text || ''),
    };
    
    // Transform timing
    if (obj.timing && typeof obj.timing === 'object') {
      const t = obj.timing as Record<string, unknown>;
      const timing: Record<string, unknown> = {};
      
      if (t.activity) timing.activity = t.activity;
      
      // Handle duration
      if (typeof t.minMinutes === 'number' && typeof t.maxMinutes === 'number') {
        timing.duration = { minMinutes: t.minMinutes, maxMinutes: t.maxMinutes };
      } else if (typeof t.minutes === 'number') {
        timing.duration = { minutes: t.minutes };
      } else if (t.duration && typeof t.duration === 'object') {
        timing.duration = t.duration;
      }
      
      if (t.completionCue) timing.completionCue = t.completionCue;
      
      if (Object.keys(timing).length > 0) {
        result.timing = timing;
      }
    }
    
    return result as SoustackRecipe['instructions'][number];
  });
}

function transformStorage(storage?: Record<string, string>): SoustackRecipe['storage'] | undefined {
  if (!storage || typeof storage !== 'object') return undefined;
  
  const result: SoustackRecipe['storage'] = {};
  
  if (storage.refrigerated) {
    result.refrigerated = {
      duration: { iso8601: parseDurationToIso(storage.refrigerated) },
      notes: storage.refrigerated,
    };
  }
  
  if (storage.frozen) {
    result.frozen = {
      duration: { iso8601: parseDurationToIso(storage.frozen) },
      notes: storage.frozen,
    };
  }
  
  if (storage.roomTemp) {
    result.roomTemp = {
      duration: { iso8601: parseDurationToIso(storage.roomTemp) },
      notes: storage.roomTemp,
    };
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseDurationToIso(str: string): string {
  const days = str.match(/(\d+)\s*days?/i);
  if (days) return `P${days[1]}D`;
  
  const months = str.match(/(\d+)\s*months?/i);
  if (months) return `P${months[1]}M`;
  
  const weeks = str.match(/(\d+)\s*weeks?/i);
  if (weeks) return `P${parseInt(weeks[1]) * 7}D`;
  
  const hours = str.match(/(\d+)\s*hours?/i);
  if (hours) return `PT${hours[1]}H`;
  
  return 'P1D';
}

function inferStacks(
  ingredients: SoustackRecipe['ingredients'],
  instructions: SoustackRecipe['instructions'],
  miseEnPlace?: SoustackRecipe['miseEnPlace'],
  storage?: SoustackRecipe['storage']
): Record<string, number> {
  const stacks: Record<string, number> = {};
  
  // quantified: structured ingredients with id and quantity
  const hasQuantified = ingredients.some(
    ing => typeof ing === 'object' && 'id' in ing && 'quantity' in ing
  );
  if (hasQuantified) stacks.quantified = 1;
  
  // structured: instructions with id
  const hasStructured = instructions.some(
    inst => typeof inst === 'object' && 'id' in inst
  );
  if (hasStructured) stacks.structured = 1;
  
  // timed: instructions with timing (requires structured)
  const hasTimed = instructions.some(
    inst => typeof inst === 'object' && 'timing' in inst
  );
  if (hasTimed && hasStructured) stacks.timed = 1;
  
  // prep: mise en place present
  if (miseEnPlace && miseEnPlace.length > 0) stacks.prep = 1;
  
  // storage: storage info present
  if (storage && Object.keys(storage).length > 0) stacks.storage = 1;
  
  return stacks;
}

// ============================================================================
// Helpers
// ============================================================================

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseRateLimitError(error: unknown): { isRateLimit: boolean; retryAfter?: number; message: string } {
  if (!(error instanceof Error)) {
    return { isRateLimit: false, message: 'Unknown error' };
  }
  
  const msg = error.message || '';
  
  if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
    const match = msg.match(/(\d+)\s*seconds/i);
    return {
      isRateLimit: true,
      retryAfter: match ? parseInt(match[1]) : 60,
      message: 'Rate limited. Please try again shortly.',
    };
  }
  
  if (msg.toLowerCase().includes('quota')) {
    return {
      isRateLimit: true,
      message: 'API quota exceeded. Please try again later.',
    };
  }
  
  return { isRateLimit: false, message: error.message };
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "text" field' },
        { status: 400 }
      );
    }
    
    const inputText = await maybeFetchUrl(text);
    const model = getGeminiModel();
    const prompt = createConvertPrompt(inputText);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const cleanJson = stripMarkdownFences(responseText);
    let parsed: Record<string, unknown>;
    
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON' },
        { status: 500 }
      );
    }
    
    const recipe = transformToSoustackRecipe(parsed, text);
    
    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Convert error:', error);
    
    const rateLimitInfo = parseRateLimitError(error);
    if (rateLimitInfo.isRateLimit) {
      return NextResponse.json(
        { error: rateLimitInfo.message },
        { status: 429 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        return NextResponse.json({ error: 'API not configured' }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
