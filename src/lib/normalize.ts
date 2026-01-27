import type { 
  SoustackLiteRecipe, 
  DisplayRecipe, 
  DisplayIngredient, 
  DisplayInstruction,
  Ingredient,
  Instruction 
} from './types';

// Extract the timing type from Instruction
type InstructionTiming = Extract<Instruction, { timing?: unknown }>['timing'];

/**
 * Transform a SoustackLiteRecipe into a normalized display format
 */
export function normalizeToDisplay(recipe: SoustackLiteRecipe): DisplayRecipe {
  return {
    title: recipe.name || 'Untitled Recipe',
    description: recipe.description,
    servings: recipe.servings,
    miseEnPlace: normalizeMiseEnPlace(recipe.miseEnPlace),
    ingredients: normalizeIngredients(recipe.ingredients),
    instructions: normalizeInstructions(recipe.instructions),
    storage: normalizeStorage(recipe.storage),
    totalTime: calculateTotalTime(recipe.instructions),
  };
}

function normalizeMiseEnPlace(items: SoustackLiteRecipe['miseEnPlace']): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map(item => typeof item === 'string' ? item : item.text)
    .filter(Boolean);
}

function normalizeIngredients(items: Ingredient[]): DisplayIngredient[] {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map((item, index) => {
    const id = `ing-${index}`;
    
    if (typeof item === 'string') {
      return {
        id,
        text: item,
        name: item,
      };
    }
    
    // Structured ingredient
    const parts: string[] = [];
    if (item.quantity !== undefined) {
      parts.push(String(item.quantity));
    }
    if (item.unit) {
      parts.push(item.unit);
    }
    parts.push(item.name);
    if (item.toTaste) {
      parts.push('(to taste)');
    }
    if (item.notes) {
      parts.push(`— ${item.notes}`);
    }
    
    return {
      id,
      text: parts.join(' '),
      quantity: item.quantity !== undefined ? String(item.quantity) : undefined,
      unit: item.unit,
      name: item.name,
      notes: item.notes,
      toTaste: item.toTaste,
    };
  });
}

function normalizeInstructions(items: Instruction[]): DisplayInstruction[] {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map((item, index) => {
    const id = `step-${index}`;
    
    if (typeof item === 'string') {
      return { id, text: item };
    }
    
    // Structured instruction
    const timing = formatTiming(item.timing);
    
    return {
      id,
      text: item.text,
      timing,
      isPassive: item.timing?.activity === 'passive',
    };
  });
}

function formatTiming(timing: InstructionTiming): string | undefined {
  if (!timing || typeof timing !== 'object') return undefined;
  
  const duration = timing.duration;
  if (!duration) return undefined;
  
  const parts: string[] = [];
  if (duration.hours) {
    parts.push(`${duration.hours}h`);
  }
  if (duration.minutes) {
    parts.push(`${duration.minutes}m`);
  }
  
  if (parts.length === 0) return undefined;
  
  let result = parts.join(' ');
  if (timing.activity === 'passive') {
    result += ' (passive)';
  }
  
  return result;
}

function normalizeStorage(storage: SoustackLiteRecipe['storage']): DisplayRecipe['storage'] | undefined {
  if (!storage) return undefined;
  
  const result: DisplayRecipe['storage'] = {};
  
  if (storage.refrigerated) {
    result.refrigerated = formatStorageDuration(storage.refrigerated);
  }
  if (storage.frozen) {
    result.frozen = formatStorageDuration(storage.frozen);
  }
  if (storage.roomTemp) {
    result.roomTemp = formatStorageDuration(storage.roomTemp);
  }
  
  if (Object.keys(result).length === 0) return undefined;
  return result;
}

function formatStorageDuration(method: { duration: { iso8601: string }; notes?: string }): string {
  // Parse ISO8601 duration (e.g., "P3D" = 3 days, "P1W" = 1 week)
  const iso = method.duration.iso8601;
  let text = iso;
  
  const dayMatch = iso.match(/P(\d+)D/);
  const weekMatch = iso.match(/P(\d+)W/);
  
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    text = days === 1 ? '1 day' : `${days} days`;
  } else if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10);
    text = weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  
  if (method.notes) {
    text += ` — ${method.notes}`;
  }
  
  return text;
}

function calculateTotalTime(instructions: Instruction[]): string | undefined {
  if (!instructions || !Array.isArray(instructions)) return undefined;
  
  let totalMinutes = 0;
  
  for (const item of instructions) {
    if (typeof item === 'object' && item.timing?.duration) {
      const d = item.timing.duration;
      if (d.hours) totalMinutes += d.hours * 60;
      if (d.minutes) totalMinutes += d.minutes;
    }
  }
  
  if (totalMinutes === 0) return undefined;
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
