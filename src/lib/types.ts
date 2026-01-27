/**
 * Soustack Recipe - the core data format
 * Supports both "lite" and "base" profiles per the Soustack spec
 */
export type SoustackRecipe = {
  $schema: string;
  profile: 'lite' | 'base';
  stacks: Record<string, number>;
  name: string;
  description?: string;
  yield?: {
    amount: number;
    unit: string;
  };
  time?: {
    total: {
      minutes: number;
    };
  };
  // Legacy field - kept for backward compatibility
  servings?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  miseEnPlace?: MiseEnPlaceItem[];
  storage?: StorageInfo;
  'x-soustack'?: {
    source?: {
      text: string;
      url?: string;
      convertedAt: string;
      converter: string;
    };
  };
  // Legacy field name
  'x-mise'?: {
    source?: {
      text: string;
      intent?: 'convert' | 'draft';
      convertedAt: string;
      converter: string;
    };
  };
};

// Keep old name as alias for backward compatibility
export type SoustackLiteRecipe = SoustackRecipe;

export type Ingredient = 
  | string 
  | {
      id?: string;
      name: string;
      quantity?: {
        amount: number;
        unit: string;
      };
      // Legacy format - quantity as number/string directly
      // Keep for backward compatibility with existing data
      unit?: string;
      prep?: string;
      notes?: string;
      toTaste?: boolean;
      scaling?: {
        mode: 'toTaste' | 'linear' | 'fixed';
      };
    };

export type Instruction = 
  | string 
  | {
      id?: string;
      text: string;
      timing?: {
        activity?: 'active' | 'passive';
        duration?: 
          | { minutes: number }
          | { minMinutes: number; maxMinutes: number };
        completionCue?: string;
      };
      temperature?: {
        target: 'oven' | 'stovetop' | 'internal' | 'oil' | 'pan' | 'grill';
        level?: 'low' | 'medium' | 'mediumHigh' | 'high';
        unit?: 'celsius' | 'fahrenheit';
        value?: number;
      };
      inputs?: string[];
    };

export type MiseEnPlaceItem = {
  text: string;
  ingredient?: string;
};

export type StorageInfo = {
  refrigerated?: { duration: { iso8601: string }; notes?: string };
  frozen?: { duration: { iso8601: string }; notes?: string };
  roomTemp?: { duration: { iso8601: string }; notes?: string };
};

/**
 * Normalized display format for rendering
 */
export type DisplayRecipe = {
  title: string;
  description?: string;
  servings?: string;
  miseEnPlace: string[];
  ingredients: DisplayIngredient[];
  instructions: DisplayInstruction[];
  storage?: DisplayStorage;
  totalTime?: string;
  // Stats for showing structure extraction
  stats: {
    structuredIngredients: number;
    totalIngredients: number;
    timedSteps: number;
    totalSteps: number;
    hasMise: boolean;
    hasStorage: boolean;
  };
};

export type DisplayIngredient = {
  id: string;
  text: string;
  quantity?: string;
  unit?: string;
  name: string;
  notes?: string;
  toTaste?: boolean;
  isStructured: boolean;
};

export type DisplayInstruction = {
  id: string;
  text: string;
  timing?: string;
  isPassive?: boolean;
  hasTiming: boolean;
};

export type DisplayStorage = {
  refrigerated?: string;
  frozen?: string;
  roomTemp?: string;
};
