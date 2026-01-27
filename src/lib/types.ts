/**
 * Soustack Lite Recipe - the core data format
 */
export type SoustackLiteRecipe = {
  $schema: string;
  profile: 'lite';
  stacks: Record<string, number>;
  name: string;
  description?: string;
  servings?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  miseEnPlace?: MiseEnPlaceItem[];
  storage?: StorageInfo;
  'x-mise'?: {
    source?: {
      text: string;
      intent: 'convert' | 'draft';
      convertedAt: string;
      converter: string;
    };
  };
};

export type Ingredient = 
  | string 
  | {
      name: string;
      quantity?: number | string;
      unit?: string;
      notes?: string;
      toTaste?: boolean;
    };

export type Instruction = 
  | string 
  | {
      text: string;
      timing?: {
        duration?: { minutes?: number; hours?: number };
        activity?: 'active' | 'passive';
        completionCue?: string;
      };
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
};

export type DisplayIngredient = {
  id: string;
  text: string;
  quantity?: string;
  unit?: string;
  name: string;
  notes?: string;
  toTaste?: boolean;
};

export type DisplayInstruction = {
  id: string;
  text: string;
  timing?: string;
  isPassive?: boolean;
};

export type DisplayStorage = {
  refrigerated?: string;
  frozen?: string;
  roomTemp?: string;
};
