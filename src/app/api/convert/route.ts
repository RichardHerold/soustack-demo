import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SoustackLiteRecipe } from '@/lib/types';

function getGeminiModel() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
}

function createConvertPrompt(text: string): string {
  return `You are a recipe parser. Convert this recipe into structured JSON.

INPUT:
${text}

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "Recipe Title",
  "description": "Brief description",
  "servings": "4 servings",
  "miseEnPlace": [
    { "text": "Prep task before cooking (e.g., 'Mince the garlic', 'Pat chicken dry', 'Preheat oven to 400°F')" }
  ],
  "ingredients": [
    { "name": "ingredient name", "quantity": 2, "unit": "cups", "notes": "optional notes" },
    { "name": "salt", "toTaste": true }
  ],
  "instructions": [
    { "text": "Step description", "timing": { "duration": { "minutes": 10 }, "activity": "active" } },
    { "text": "Let rest", "timing": { "duration": { "minutes": 5 }, "activity": "passive", "completionCue": "until cool" } }
  ],
  "storage": {
    "refrigerated": { "duration": { "iso8601": "P3D" }, "notes": "in airtight container" }
  }
}

IMPORTANT RULES:
- miseEnPlace: Extract ALL prep tasks that should happen BEFORE cooking starts:
  * Preheating (oven, grill, pan)
  * Chopping, dicing, mincing vegetables
  * Measuring out spices
  * Bringing ingredients to room temperature
  * Marinating
  * Toasting nuts/spices
  * Any "meanwhile, prepare..." tasks
- Parse quantities as numbers when possible (1.5, not "1 1/2")
- Identify passive vs active time:
  * active = hands-on cooking (sautéing, stirring)
  * passive = waiting (baking, marinating, resting, simmering unattended)
- Only include storage if the recipe mentions how long it keeps
- Return ONLY valid JSON, no explanation or markdown fences`;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function maybeFetchUrl(text: string): Promise<string> {
  const trimmed = text.trim();
  
  // Check if it looks like a URL
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
    
    // Try to extract JSON-LD structured data first (schema.org Recipe)
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch;
    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      const jsonContent = jsonLdMatch[1].trim();
      
      try {
        const data = JSON.parse(jsonContent);
        
        // Helper to check if an item is a Recipe type
        const isRecipe = (item: any): boolean => {
          if (!item) return false;
          const type = item['@type'] || item.type;
          if (!type) return false;
          // Handle both string and array formats
          if (Array.isArray(type)) {
            return type.includes('Recipe');
          }
          return type === 'Recipe';
        };
        
        // Handle both single objects and arrays
        const recipes = Array.isArray(data) 
          ? data.filter(isRecipe)
          : (isRecipe(data) ? [data] : []);
        
        if (recipes.length > 0) {
          const recipe = recipes[0];
          // Convert structured data to readable text format
          const parts: string[] = [];
          
          if (recipe.name) parts.push(recipe.name);
          if (recipe.description) parts.push(recipe.description);
          if (recipe.recipeYield) parts.push(`Serves: ${recipe.recipeYield}`);
          if (recipe.prepTime) parts.push(`Prep time: ${recipe.prepTime}`);
          if (recipe.cookTime) parts.push(`Cook time: ${recipe.cookTime}`);
          if (recipe.totalTime) parts.push(`Total time: ${recipe.totalTime}`);
          
          if (recipe.recipeIngredient && Array.isArray(recipe.recipeIngredient)) {
            parts.push('\nIngredients:');
            recipe.recipeIngredient.forEach((ing: string) => {
              parts.push(`- ${ing}`);
            });
          }
          
          if (recipe.recipeInstructions) {
            parts.push('\nInstructions:');
            const instructions = Array.isArray(recipe.recipeInstructions)
              ? recipe.recipeInstructions
              : [recipe.recipeInstructions];
            
            instructions.forEach((inst: any, idx: number) => {
              if (typeof inst === 'string') {
                parts.push(`${idx + 1}. ${inst}`);
              } else if (inst.text) {
                parts.push(`${idx + 1}. ${inst.text}`);
              } else if (inst['@type'] === 'HowToStep' && inst.text) {
                parts.push(`${idx + 1}. ${inst.text}`);
              }
            });
          }
          
          const structuredText = parts.join('\n');
          // Truncate to ~8000 chars to stay within token limits
          return structuredText.slice(0, 8000);
        }
      } catch {
        // If JSON parsing fails, continue to fallback methods
        continue;
      }
    }
    
    // Fallback: Try to find main content area
    // Look for common recipe content selectors
    const contentSelectors = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
      /<div[^>]*class=["'][^"']*recipe[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id=["'][^"']*recipe[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ];
    
    for (const selector of contentSelectors) {
      const match = html.match(selector);
      if (match && match[1]) {
        const content = match[1];
        // Remove scripts, styles, and other non-content elements
        const textContent = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        
        if (textContent.length > 200) {
          // Truncate to ~8000 chars to stay within token limits
          return textContent.slice(0, 8000);
        }
      }
    }
    
    // Final fallback: Extract text content from entire page, strip HTML tags
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    // Truncate to ~8000 chars to stay within token limits
    return textContent.slice(0, 8000);
  } catch {
    return trimmed;
  }
}

function transformToSoustackRecipe(
  parsed: Record<string, unknown>,
  originalText: string
): SoustackLiteRecipe {
  const now = new Date().toISOString();
  
  return {
    $schema: 'https://soustack.org/lite.schema.json',
    profile: 'lite',
    stacks: inferStacks(parsed),
    name: String(parsed.name || 'Untitled Recipe'),
    description: parsed.description ? String(parsed.description) : undefined,
    servings: parsed.servings ? String(parsed.servings) : undefined,
    miseEnPlace: Array.isArray(parsed.miseEnPlace) ? parsed.miseEnPlace : undefined,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    storage: parsed.storage as SoustackLiteRecipe['storage'],
    'x-mise': {
      source: {
        text: originalText.slice(0, 500),
        intent: 'convert',
        convertedAt: now,
        converter: 'gemini-2.0-flash-lite',
      },
    },
  };
}

function inferStacks(parsed: Record<string, unknown>): Record<string, number> {
  const stacks: Record<string, number> = {};
  
  // Check for timing in instructions
  const instructions = parsed.instructions;
  if (Array.isArray(instructions)) {
    const hasTiming = instructions.some(
      (i) => typeof i === 'object' && i !== null && 'timing' in i
    );
    if (hasTiming) stacks.timed = 1;
  }
  
  // Check for structured ingredients (scalable)
  const ingredients = parsed.ingredients;
  if (Array.isArray(ingredients)) {
    const hasQuantity = ingredients.some(
      (i) => typeof i === 'object' && i !== null && 'quantity' in i
    );
    if (hasQuantity) stacks.scaling = 1;
  }
  
  // Check for mise en place
  if (Array.isArray(parsed.miseEnPlace) && parsed.miseEnPlace.length > 0) {
    stacks.prep = 1;
  }
  
  // Check for storage
  if (parsed.storage && typeof parsed.storage === 'object') {
    stacks.storage = 1;
  }
  
  return stacks;
}

function parseRateLimitError(error: unknown): { isRateLimit: boolean; retryAfter?: number; message: string } {
  if (!(error instanceof Error)) {
    return { isRateLimit: false, message: 'Unknown error' };
  }
  
  const message = error.message || '';
  
  // Check for 429 rate limit errors
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    // Try to extract retry delay
    const retryMatch = message.match(/retry after (\d+)/i) || message.match(/(\d+) seconds/i);
    const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;
    
    return {
      isRateLimit: true,
      retryAfter,
      message: `Rate limited. Please try again in ${retryAfter} seconds.`,
    };
  }
  
  // Check for quota exceeded
  if (message.toLowerCase().includes('quota')) {
    return {
      isRateLimit: true,
      message: 'API quota exceeded. Please try again later.',
    };
  }
  
  return { isRateLimit: false, message: error.message };
}

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
    
    // If it looks like a URL, fetch it first
    const inputText = await maybeFetchUrl(text);
    
    // Get Gemini model
    const model = getGeminiModel();
    
    // Create prompt and call Gemini
    const prompt = createConvertPrompt(inputText);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();
    
    // Parse JSON response
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
    
    // Transform to Soustack format
    const recipe = transformToSoustackRecipe(parsed, text);
    
    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Convert error:', error);
    
    // Check for rate limit errors
    const rateLimitInfo = parseRateLimitError(error);
    if (rateLimitInfo.isRateLimit) {
      return NextResponse.json(
        { error: rateLimitInfo.message },
        { status: 429 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        return NextResponse.json(
          { error: 'API not configured' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Unknown error' },
      { status: 500 }
    );
  }
}
