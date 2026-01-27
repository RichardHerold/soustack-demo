/**
 * Soustack Recipe Conversion API
 * 
 * POST /api/convert
 * Body: { text: string } - Recipe text or URL
 * Returns: { recipe: SoustackRecipe }
 * 
 * This route:
 * 1. Detects URLs and fetches content (prioritizing JSON-LD schema.org)
 * 2. Sends text to Gemini with optimized prompt
 * 3. Post-processes AI output into spec-compliant Soustack format
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SoustackRecipe, Ingredient, Instruction } from '@/lib/types';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_TEXT_LENGTH = 8000;

function getGeminiModel() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not defined');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a recipe parser. Convert recipe text to structured JSON.

## Output Format

Return ONLY valid JSON. No markdown fences. No explanation.

{
  "name": "Recipe Name",
  "description": "Optional description",
  "servings": "4 servings" | "Makes 24 cookies" | null,
  "totalTime": "45 minutes" | "1 hour 30 minutes" | null,
  "miseEnPlace": ["task 1", "task 2"],
  "ingredients": [...],
  "instructions": [...],
  "storage": { "refrigerated": "3-4 days", "frozen": "up to 3 months" } | null
}

## Ingredient Rules

Each ingredient is either a string OR structured object:

### String (when minimal info):
"fresh herbs for garnish"
"salt and pepper to taste"

### Object (when parseable):
{
  "name": "all-purpose flour",
  "quantity": 2.5,
  "unit": "cups",
  "prep": "sifted",
  "notes": "room temperature",
  "toTaste": false
}

### Quantity Parsing

| Input | quantity | unit |
|-------|----------|------|
| "2 cups" | 2 | "cups" |
| "1/2 cup" | 0.5 | "cup" |
| "1 1/2 tbsp" | 1.5 | "tbsp" |
| "2-3 cloves" | 2.5 | "cloves" |
| "500g" | 500 | "g" |
| "2 large eggs" | 2 | "large" + name:"eggs" |
| "pinch of" | 1 | "pinch" |
| "to taste" | null | null + toTaste:true |

### Prep Extraction

Extract these from ingredient text into "prep" field:
diced, minced, chopped, sliced, julienned, cubed, shredded, grated, crushed, softened, melted, beaten, sifted, toasted, peeled, deveined, trimmed, halved, quartered

### Notes Extraction

Extract into "notes" field:
- Temperature: "room temperature", "cold", "chilled"
- Quality: "high-quality", "fresh"
- Optional: "optional", "for garnish", "for serving"

## Instruction Rules

Each instruction is either a string OR structured object:

### String (minimal):
"Preheat oven to 350°F"

### Object (when timing/temperature present):
{
  "text": "Sauté onions until translucent",
  "timing": {
    "minutes": 10,
    "minMinutes": 8,
    "maxMinutes": 10,
    "activity": "active" | "passive",
    "completionCue": "until translucent"
  },
  "temperature": {
    "value": 350,
    "unit": "F" | "C",
    "level": "low" | "medium" | "medium-high" | "high"
  }
}

### Timing Extraction

| Pattern | Result |
|---------|--------|
| "cook 10 minutes" | { minutes: 10, activity: "active" } |
| "bake 25-30 min" | { minMinutes: 25, maxMinutes: 30, activity: "passive" } |
| "let rest 1 hour" | { minutes: 60, activity: "passive" } |
| "until golden" | { completionCue: "until golden" } |
| "simmer 20 min until thick" | { minutes: 20, completionCue: "until thick", activity: "active" } |
| "refrigerate overnight" | { minutes: 480, activity: "passive" } |
| "let rise 1-2 hours" | { minMinutes: 60, maxMinutes: 120, activity: "passive" } |

### Activity Types

**active** = requires attention: sauté, stir, whisk, knead, flip, fry, chop, mix, beat, fold
**passive** = unattended: bake, roast, simmer, rest, rise, chill, marinate, freeze, refrigerate, cool

### Temperature Extraction

| Pattern | Result |
|---------|--------|
| "350°F" | { value: 350, unit: "F" } |
| "180°C" | { value: 180, unit: "C" } |
| "medium heat" | { level: "medium" } |
| "high heat" | { level: "high" } |
| "medium-high" | { level: "medium-high" } |

## Mise en Place

Extract pre-cooking tasks. Look for:
- "Before you begin" sections
- Room temperature requirements
- Prep instructions that happen BEFORE cooking
- Equipment preparation (preheat oven counts)

Examples:
- "Bring butter to room temperature"
- "Preheat oven to 350°F"
- "Dice all vegetables"
- "Measure out spices"

## Storage

If storage/shelf life info is mentioned:
{
  "storage": {
    "refrigerated": "3-4 days",
    "frozen": "up to 3 months",
    "roomTemp": "2 hours"
  }
}

## Critical Rules

1. Use numbers for quantities: 2 not "2"
2. Use null (not empty string) for missing optional fields
3. Extract prep verbs from ingredient text
4. Separate mise en place from cooking instructions
5. Include timing even when only completion cue exists
6. Output ONLY JSON - no text before or after`;

function createConvertPrompt(text: string): string {
  return `${SYSTEM_PROMPT}

Parse this recipe:

"""
${text}
"""`;
}

// ============================================================================
// URL Fetching
// ============================================================================

async function maybeFetchUrl(text: string): Promise<string> {
  // Check if it looks like a URL
  const urlPattern = /^https?:\/\//i;
  if (!urlPattern.test(text.trim())) {
    return text;
  }

  try {
    const response = await fetch(text.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoustackBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Try to extract JSON-LD structured data first (schema.org Recipe)
    try {
      const jsonLdMatch = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      );

      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          const jsonContent = match.replace(
            /<script[^>]*>|<\/script>/gi,
            ''
          );

          try {
            const data = JSON.parse(jsonContent);

            // Helper to check if an item is a Recipe type
            const isRecipe = (item: any): boolean =>
              item?.['@type'] === 'Recipe' ||
              (Array.isArray(item?.['@type']) && item['@type'].includes('Recipe'));

            // Handle @graph format (common in modern sites)
            let recipe = null;
            if (data['@graph']) {
              recipe = data['@graph'].find(isRecipe);
            } else if (Array.isArray(data)) {
              recipe = data.find(isRecipe);
            } else if (isRecipe(data)) {
              recipe = data;
            }

            if (recipe) {
              // Convert structured data to readable text format
              const parts = [];

              if (recipe.name) parts.push(recipe.name);
              if (recipe.description) parts.push(recipe.description);

              // Handle servings
              if (recipe.recipeYield) {
                const yieldStr = Array.isArray(recipe.recipeYield)
                  ? recipe.recipeYield[0]
                  : recipe.recipeYield;
                parts.push(`Serves: ${yieldStr}`);
              }

              // Handle times
              const times = [];
              if (recipe.prepTime) times.push(`Prep: ${formatISODuration(recipe.prepTime)}`);
              if (recipe.cookTime) times.push(`Cook: ${formatISODuration(recipe.cookTime)}`);
              if (recipe.totalTime) times.push(`Total: ${formatISODuration(recipe.totalTime)}`);
              if (times.length) parts.push(times.join(' | '));

              // Ingredients
              if (recipe.recipeIngredient?.length) {
                parts.push('\nIngredients:');
                for (const ing of recipe.recipeIngredient) {
                  parts.push(`- ${ing}`);
                }
              }

              // Instructions
              if (recipe.recipeInstructions?.length) {
                parts.push('\nInstructions:');
                for (let i = 0; i < recipe.recipeInstructions.length; i++) {
                  const inst = recipe.recipeInstructions[i];
                  const text = typeof inst === 'string' ? inst : inst.text || inst.name;
                  if (text) parts.push(`${i + 1}. ${text}`);
                }
              }

              const recipeText = parts.join('\n');
              return recipeText.slice(0, MAX_TEXT_LENGTH);
            }
          } catch {
            // Continue to next JSON-LD block
          }
        }
      }
    } catch {
      // If JSON-LD parsing fails, continue to fallback
    }

    // Fallback: extract text content
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return textContent.slice(0, MAX_TEXT_LENGTH);
  } catch (error) {
    console.error('URL fetch error:', error);
    throw new Error('Failed to fetch recipe from URL');
  }
}

/**
 * Format ISO 8601 duration to readable string
 */
function formatISODuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes) return `${minutes} minutes`;
  return iso;
}

// ============================================================================
// Post-Processing: Transform AI output to Soustack format
// ============================================================================

interface RawIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  prep?: string;
  notes?: string;
  toTaste?: boolean;
}

interface RawInstruction {
  text: string;
  timing?: {
    minutes?: number;
    minMinutes?: number;
    maxMinutes?: number;
    activity?: 'active' | 'passive';
    completionCue?: string;
  };
  temperature?: {
    value?: number;
    unit?: 'F' | 'C';
    level?: string;
  };
}

function transformToSoustackRecipe(
  parsed: Record<string, unknown>,
  originalText: string
): SoustackRecipe {
  const now = new Date().toISOString();

  // Parse yield from servings string
  const yield_ = parseYield(parsed.servings as string | null | undefined);

  // Parse time
  const time = parseTime(parsed.totalTime as string | null | undefined);

  // Transform ingredients
  const rawIngredients = (parsed.ingredients || []) as Array<string | RawIngredient>;
  const ingredients = transformIngredients(rawIngredients);

  // Transform instructions
  const rawInstructions = (parsed.instructions || []) as Array<string | RawInstruction>;
  const instructions = transformInstructions(rawInstructions);

  // Transform mise en place
  const rawMise = parsed.miseEnPlace as string[] | undefined;
  const miseEnPlace = rawMise?.length ? rawMise.map(text => ({ text })) : undefined;

  // Transform storage
  const storage = transformStorage(parsed.storage as Record<string, string> | null | undefined);

  // Infer stacks based on content
  const stacks = inferStacks(ingredients, instructions, miseEnPlace, storage);

  // Determine profile
  const profile = (yield_ || time) ? 'base' : 'lite';

  const recipe: SoustackRecipe = {
    $schema: 'https://spec.soustack.org/soustack.schema.json',
    profile,
    stacks,
    name: (parsed.name as string) || 'Untitled Recipe',
    ingredients,
    instructions,
    'x-soustack': {
      source: {
        text: originalText.slice(0, 500),
        convertedAt: now,
        converter: GEMINI_MODEL,
      },
    },
  };

  // Add optional fields only if present
  if (parsed.description) recipe.description = parsed.description as string;
  if (yield_) recipe.yield = yield_;
  if (time) recipe.time = { total: time };
  if (miseEnPlace) recipe.miseEnPlace = miseEnPlace;
  if (storage) recipe.storage = storage;

  return recipe;
}

function parseYield(servings?: string | null): { amount: number; unit: string } | undefined {
  if (!servings) return undefined;

  const patterns = [
    /^(?:makes\s+)?(\d+(?:-\d+)?)\s+(.+)$/i,
    /^serves?\s+(\d+(?:-\d+)?)$/i,
  ];

  for (const pattern of patterns) {
    const match = servings.match(pattern);
    if (match) {
      const amountStr = match[1];
      const unit = match[2] || 'servings';

      let amount: number;
      if (amountStr.includes('-')) {
        const [min, max] = amountStr.split('-').map(Number);
        amount = (min + max) / 2;
      } else {
        amount = Number(amountStr);
      }

      if (!isNaN(amount) && amount > 0) {
        return { amount, unit: unit.toLowerCase() };
      }
    }
  }

  return undefined;
}

function parseTime(timeStr?: string | null): { minutes: number } | undefined {
  if (!timeStr) return undefined;

  let totalMinutes = 0;

  const hourMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/i);
  if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;

  const minMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)(?!\w)/i);
  if (minMatch) totalMinutes += parseFloat(minMatch[1]);

  return totalMinutes > 0 ? { minutes: Math.round(totalMinutes) } : undefined;
}

function transformIngredients(ingredients: Array<string | RawIngredient>): Ingredient[] {
  return ingredients.flatMap(ing => {
    if (typeof ing === 'string') {
      // Check for "to taste" in string
      if (/to\s*taste/i.test(ing)) {
        return handleToTasteString(ing);
      }
      return ing;
    }

    const result: Ingredient = {
      name: ing.name,
    };

    if (ing.quantity != null) {
      result.quantity = ing.quantity;
    }
    if (ing.unit) {
      result.unit = ing.unit;
    }
    if (ing.notes && !/^to\s*taste$/i.test(ing.notes)) {
      result.notes = ing.notes;
    }
    if (ing.toTaste) {
      result.toTaste = true;
    }

    return result;
  });
}

function handleToTasteString(str: string): Ingredient[] {
  // "salt and pepper to taste"
  const compoundMatch = str.match(/^(.+?)\s+and\s+(.+?)\s+to\s*taste$/i);
  if (compoundMatch) {
    return [
      { name: compoundMatch[1].trim(), toTaste: true },
      { name: compoundMatch[2].trim(), toTaste: true },
    ];
  }

  // "X to taste"
  const singleMatch = str.match(/^(.+?)\s+to\s*taste$/i);
  if (singleMatch) {
    return [{ name: singleMatch[1].trim(), toTaste: true }];
  }

  return [str];
}

function transformInstructions(instructions: Array<string | RawInstruction>): Instruction[] {
  return instructions.map(inst => {
    if (typeof inst === 'string') return inst;

    const result: Instruction = {
      text: inst.text,
    };

    if (inst.timing) {
      const timing: {
        duration?: { minutes?: number; hours?: number };
        activity?: 'active' | 'passive';
        completionCue?: string;
      } = {};
      if (inst.timing.activity) timing.activity = inst.timing.activity;
      if (inst.timing.minMinutes != null && inst.timing.maxMinutes != null) {
        // Convert range to average minutes
        const avgMinutes = Math.round((inst.timing.minMinutes + inst.timing.maxMinutes) / 2);
        timing.duration = { minutes: avgMinutes };
      } else if (inst.timing.minutes != null) {
        timing.duration = { minutes: inst.timing.minutes };
      }
      if (inst.timing.completionCue) timing.completionCue = inst.timing.completionCue;
      if (Object.keys(timing).length) result.timing = timing;
    }

    return result;
  });
}

function transformStorage(storage?: Record<string, string> | null): Record<string, unknown> | undefined {
  if (!storage) return undefined;

  const result: Record<string, unknown> = {};

  if (storage.refrigerated) {
    result.refrigerated = { duration: parseDurationToISO(storage.refrigerated), notes: storage.refrigerated };
  }
  if (storage.frozen) {
    result.frozen = { duration: parseDurationToISO(storage.frozen), notes: storage.frozen };
  }
  if (storage.roomTemp) {
    result.roomTemp = { duration: parseDurationToISO(storage.roomTemp), notes: storage.roomTemp };
  }

  return Object.keys(result).length ? result : undefined;
}

function parseDurationToISO(str: string): { iso8601: string } {
  const dayMatch = str.match(/(\d+)(?:-\d+)?\s*days?/i);
  if (dayMatch) return { iso8601: `P${dayMatch[1]}D` };

  const monthMatch = str.match(/(\d+)(?:-\d+)?\s*months?/i);
  if (monthMatch) return { iso8601: `P${monthMatch[1]}M` };

  const weekMatch = str.match(/(\d+)(?:-\d+)?\s*weeks?/i);
  if (weekMatch) return { iso8601: `P${parseInt(weekMatch[1]) * 7}D` };

  const hourMatch = str.match(/(\d+)(?:-\d+)?\s*hours?/i);
  if (hourMatch) return { iso8601: `PT${hourMatch[1]}H` };

  return { iso8601: 'P1D' };
}

function inferStacks(
  ingredients: Ingredient[],
  instructions: Instruction[],
  miseEnPlace?: Array<{ text: string }>,
  storage?: Record<string, unknown>
): Record<string, number> {
  const stacks: Record<string, number> = {};

  const hasQuantified = ingredients.some(
    ing => typeof ing === 'object' && ing !== null && 'quantity' in ing
  );
  if (hasQuantified) stacks.quantified = 1;

  const hasStructured = instructions.some(
    inst => typeof inst === 'object' && inst !== null && 'timing' in inst
  );
  if (hasStructured) stacks.structured = 1;

  const hasTimed = instructions.some(
    inst => typeof inst === 'object' && inst !== null && 'timing' in inst
  );
  if (hasTimed && hasStructured) stacks.timed = 1;

  if (miseEnPlace?.length) stacks.prep = 1;
  if (storage && Object.keys(storage).length) stacks.storage = 1;

  return stacks;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```json\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

// ============================================================================
// Error Handling
// ============================================================================

function parseRateLimitError(error: unknown): { isRateLimit: boolean; retryAfter?: number; message: string } {
  if (error instanceof Error) {
    const message = error.message;

    if (message.includes('429') || message.includes('Too Many Requests')) {
      const retryMatch = message.match(/retry.+?(\d+)/i);
      return {
        isRateLimit: true,
        retryAfter: retryMatch ? parseInt(retryMatch[1]) : 60,
        message: 'Rate limit exceeded. Please wait a moment and try again.',
      };
    }

    if (message.includes('quota') || message.includes('exceeded')) {
      return {
        isRateLimit: true,
        message: 'API quota exceeded. Please try again later.',
      };
    }
  }

  return { isRateLimit: false, message: 'Unknown error' };
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
        { error: 'Missing or invalid text field' },
        { status: 400 }
      );
    }

    // If it looks like a URL, fetch it first
    const recipeText = await maybeFetchUrl(text);

    // Get Gemini model
    const model = getGeminiModel();

    // Create prompt and call Gemini
    const prompt = createConvertPrompt(recipeText);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    // Parse JSON response
    const cleanJson = stripMarkdownFences(responseText);
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error('JSON parse error. Raw response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON', raw: cleanJson },
        { status: 500 }
      );
    }

    // Transform to Soustack format
    const recipe = transformToSoustackRecipe(parsed, text);

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Convert error:', error);

    // Check for rate limit errors
    const rateLimitInfo = parseRateLimitError(error);
    if (rateLimitInfo.isRateLimit) {
      return NextResponse.json(
        { error: rateLimitInfo.message, retryAfter: rateLimitInfo.retryAfter },
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
