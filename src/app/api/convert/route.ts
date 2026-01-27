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
    { "text": "Prep task before cooking (e.g., 'Mince the garlic', 'Pat chicken dry')" }
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

RULES:
- Extract mise en place: prep tasks that should be done BEFORE cooking starts (chopping, measuring, preheating)
- Parse quantities as numbers when possible
- Identify passive vs active time (passive = waiting/resting/baking unattended)
- Only include storage if the recipe mentions it
- Return ONLY valid JSON, no explanation`;
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
    
    // Extract text content, strip HTML tags
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
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

  const errorMessage = error.message;
  
  // Check for 429 rate limit errors
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota')) {
    // Try to extract retry delay from error message
    const retryMatch = errorMessage.match(/retry in ([\d.]+)s/i) || 
                       errorMessage.match(/retryDelay["']?\s*:\s*["']?(\d+)/i);
    
    let retryAfter: number | undefined;
    if (retryMatch) {
      retryAfter = Math.ceil(parseFloat(retryMatch[1]));
    }
    
    // Check if it's a quota exceeded error
    if (errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
      return {
        isRateLimit: true,
        retryAfter,
        message: retryAfter 
          ? `API rate limit exceeded. Please try again in ${retryAfter} seconds.`
          : 'API rate limit exceeded. You may have reached your free tier quota. Please wait a moment and try again, or check your Google AI Studio billing settings.'
      };
    }
    
    return {
      isRateLimit: true,
      retryAfter,
      message: retryAfter
        ? `API rate limit exceeded. Please try again in ${retryAfter} seconds.`
        : 'API rate limit exceeded. Please wait a moment and try again.'
    };
  }
  
  return { isRateLimit: false, message: errorMessage };
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
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        return NextResponse.json(
          { error: 'API not configured' },
          { status: 500 }
        );
      }
      
      // Check for rate limit errors
      const rateLimitInfo = parseRateLimitError(error);
      if (rateLimitInfo.isRateLimit) {
        return NextResponse.json(
          { 
            error: rateLimitInfo.message,
            retryAfter: rateLimitInfo.retryAfter,
            code: 'RATE_LIMIT'
          },
          { 
            status: 429,
            headers: rateLimitInfo.retryAfter ? {
              'Retry-After': rateLimitInfo.retryAfter.toString()
            } : undefined
          }
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
