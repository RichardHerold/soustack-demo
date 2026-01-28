import { NextRequest, NextResponse } from 'next/server';
import type { SoustackRecipe } from '@/lib/types';

interface StoredRecipe {
  recipe: SoustackRecipe;
  expires: number;
}

const recipeStore = new Map<string, StoredRecipe>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of recipeStore) {
    if (entry.expires < now) recipeStore.delete(id);
  }
}, 60000);

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export async function POST(request: NextRequest) {
  try {
    const { recipe } = await request.json();
    
    if (!recipe?.name || !Array.isArray(recipe?.ingredients)) {
      return NextResponse.json(
        { error: 'Invalid recipe' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }
    
    const id = generateId();
    recipeStore.set(id, { recipe, expires: Date.now() + TTL_MS });
    
    return NextResponse.json(
      { id, expiresIn: TTL_MS / 1000 },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to store' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (!id) {
    return NextResponse.json(
      { error: 'Missing id' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const entry = recipeStore.get(id);
  if (!entry || entry.expires < Date.now()) {
    recipeStore.delete(id!);
    return NextResponse.json(
      { error: 'Not found or expired' },
      { status: 404, headers: corsHeaders }
    );
  }
  
  return NextResponse.json(
    { recipe: entry.recipe },
    { headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
