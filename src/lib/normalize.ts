import type { 
  SoustackRecipe,
  SoustackLiteRecipe,
  DisplayRecipe, 
  DisplayIngredient, 
  DisplayInstruction,
  Ingredient,
  Instruction 
} from './types';

/**
 * Transform a SoustackRecipe into a normalized display format
 */
export function normalizeToDisplay(recipe: SoustackRecipe | SoustackLiteRecipe): DisplayRecipe {
  const ingredients = normalizeIngredients(recipe.ingredients);
  const instructions = normalizeInstructions(recipe.instructions);
  const miseEnPlace = normalizeMiseEnPlace(recipe.miseEnPlace);
  const storage = normalizeStorage(recipe.storage);
  
  // Get servings - prefer new yield format, fall back to legacy servings
  const servings = recipe.yield 
    ? `${recipe.yield.amount} ${recipe.yield.unit}`
    : recipe.servings;
  
  return {
    title: recipe.name || 'Untitled Recipe',
    description: recipe.description,
    servings,
    miseEnPlace,
    ingredients,
    instructions,
    storage,
    totalTime: recipe.time?.total 
      ? formatMinutes(recipe.time.total.minutes)
      : calculateTotalTime(recipe.instructions),
    stats: {
      structuredIngredients: ingredients.filter(i => i.isStructured).length,
      totalIngredients: ingredients.length,
      timedSteps: instructions.filter(i => i.hasTiming).length,
      totalSteps: instructions.length,
      hasMise: miseEnPlace.length > 0,
      hasStorage: storage !== undefined && Object.keys(storage).length > 0,
    },
  };
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function normalizeMiseEnPlace(items: SoustackRecipe['miseEnPlace']): string[] {
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
        isStructured: false,
      };
    }
    
    // Structured ingredient
    const parts: string[] = [];
    
    // Handle new quantity format: { amount, unit }
    if (item.quantity && typeof item.quantity === 'object' && 'amount' in item.quantity) {
      parts.push(String(item.quantity.amount));
      if (item.quantity.unit) {
        parts.push(item.quantity.unit);
      }
    } 
    // Handle legacy format: quantity as number/string, unit as separate field
    else if (item.quantity !== undefined) {
      parts.push(String(item.quantity));
      if (item.unit) {
        parts.push(item.unit);
      }
    } else if (item.unit) {
      parts.push(item.unit);
    }
    
    parts.push(item.name);
    
    // Handle toTaste - check both direct flag and scaling.mode
    const isToTaste = item.toTaste || (item.scaling?.mode === 'toTaste');
    if (isToTaste) {
      parts.push('(to taste)');
    }
    
    if (item.prep) {
      parts.push(`(${item.prep})`);
    }
    
    if (item.notes) {
      parts.push(`— ${item.notes}`);
    }
    
    // It's structured if we have any parsed parts
    const hasQuantity = item.quantity !== undefined || 
      (typeof item.quantity === 'object' && 'amount' in item.quantity);
    const isStructured = hasQuantity || item.unit !== undefined || isToTaste || item.prep !== undefined;
    
    // Get quantity string for display
    let quantityStr: string | undefined;
    if (item.quantity && typeof item.quantity === 'object' && 'amount' in item.quantity) {
      quantityStr = String(item.quantity.amount);
    } else if (item.quantity !== undefined) {
      quantityStr = String(item.quantity);
    }
    
    // Get unit string for display
    let unitStr: string | undefined;
    if (item.quantity && typeof item.quantity === 'object' && 'unit' in item.quantity) {
      unitStr = item.quantity.unit;
    } else if (item.unit) {
      unitStr = item.unit;
    }
    
    return {
      id,
      text: parts.join(' '),
      quantity: quantityStr,
      unit: unitStr,
      name: item.name,
      notes: item.notes,
      toTaste: isToTaste,
      isStructured,
    };
  });
}

function normalizeInstructions(items: Instruction[]): DisplayInstruction[] {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map((item, index) => {
    const id = `step-${index}`;
    
    if (typeof item === 'string') {
      return { id, text: item, hasTiming: false };
    }
    
    // Structured instruction
    const timing = formatTiming(item.timing);
    const hasTiming = timing !== undefined;
    
    return {
      id,
      text: item.text,
      timing,
      isPassive: item.timing?.activity === 'passive',
      hasTiming,
    };
  });
}

type TimingType = NonNullable<Extract<Instruction, { timing?: unknown }>['timing']>;

function formatTiming(timing: TimingType | undefined): string | undefined {
  if (!timing || typeof timing !== 'object') return undefined;
  
  const duration = timing.duration;
  if (!duration) {
    // Might have only completionCue
    if (timing.completionCue) {
      return timing.completionCue;
    }
    return undefined;
  }
  
  const parts: string[] = [];
  
  // Handle new format: { minutes } or { minMinutes, maxMinutes }
  if ('minMinutes' in duration && 'maxMinutes' in duration) {
    parts.push(`${duration.minMinutes}-${duration.maxMinutes}m`);
  } else if ('minutes' in duration) {
    const mins = duration.minutes;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainder = mins % 60;
      if (remainder > 0) {
        parts.push(`${hours}h ${remainder}m`);
      } else {
        parts.push(`${hours}h`);
      }
    } else {
      parts.push(`${mins}m`);
    }
  }
  // Handle legacy format: { hours, minutes }
  else if ('hours' in duration || 'minutes' in duration) {
    const d = duration as { hours?: number; minutes?: number };
    if (d.hours) parts.push(`${d.hours}h`);
    if (d.minutes) parts.push(`${d.minutes}m`);
  }
  
  if (parts.length === 0) {
    if (timing.completionCue) {
      return timing.completionCue;
    }
    return undefined;
  }
  
  let result = parts.join(' ');
  if (timing.activity === 'passive') {
    result += ' (passive)';
  }
  
  return result;
}

function normalizeStorage(storage: SoustackRecipe['storage']): DisplayRecipe['storage'] | undefined {
  if (!storage) return undefined;
  
  const result: DisplayRecipe['storage'] = {};
  
  if (storage.refrigerated && storage.refrigerated.duration) {
    result.refrigerated = formatStorageDuration(storage.refrigerated);
  }
  if (storage.frozen && storage.frozen.duration) {
    result.frozen = formatStorageDuration(storage.frozen);
  }
  if (storage.roomTemp && storage.roomTemp.duration) {
    result.roomTemp = formatStorageDuration(storage.roomTemp);
  }
  
  if (Object.keys(result).length === 0) return undefined;
  return result;
}

function formatStorageDuration(method: { duration: { iso8601: string }; notes?: string }): string {
  const iso = method?.duration?.iso8601;
  
  if (!iso || typeof iso !== 'string') {
    return method?.notes || 'Duration not specified';
  }
  
  let text = iso;
  
  const dayMatch = iso.match(/P(\d+)D/);
  const monthMatch = iso.match(/P(\d+)M/);
  const weekMatch = iso.match(/P(\d+)W/);
  const hourMatch = iso.match(/PT(\d+)H/);
  
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    text = days === 1 ? '1 day' : `${days} days`;
  } else if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10);
    text = weeks === 1 ? '1 week' : `${weeks} weeks`;
  } else if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    text = months === 1 ? '1 month' : `${months} months`;
  } else if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    text = hours === 1 ? '1 hour' : `${hours} hours`;
  }
  
  // Use notes if more descriptive than parsed duration
  if (method.notes && method.notes !== text) {
    return method.notes;
  }
  
  return text;
}

function calculateTotalTime(instructions: Instruction[]): string | undefined {
  if (!instructions || !Array.isArray(instructions)) return undefined;
  
  let totalMinutes = 0;
  
  for (const item of instructions) {
    if (typeof item === 'object' && item.timing?.duration) {
      const d = item.timing.duration;
      
      // Handle new format
      if ('minutes' in d) {
        totalMinutes += d.minutes;
      } else if ('minMinutes' in d && 'maxMinutes' in d) {
        // Use average of range
        totalMinutes += (d.minMinutes + d.maxMinutes) / 2;
      }
      // Handle legacy format
      else if ('hours' in d || 'minutes' in d) {
        const legacy = d as { hours?: number; minutes?: number };
        if (legacy.hours) totalMinutes += legacy.hours * 60;
        if (legacy.minutes) totalMinutes += legacy.minutes;
      }
    }
  }
  
  if (totalMinutes === 0) return undefined;
  
  return formatMinutes(Math.round(totalMinutes));
}
