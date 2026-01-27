/**
 * Example recipes for "Try an example" feature
 * These are real recipe URLs that demonstrate Soustack's capabilities
 */
export const EXAMPLE_RECIPES = [
  {
    id: 'nyt-chicken',
    label: 'NYT Chicken Marbella',
    url: 'https://cooking.nytimes.com/recipes/1016212-chicken-marbella',
    description: 'Classic dinner party recipe with complex prep',
  },
  {
    id: 'serious-eats-steak',
    label: 'Serious Eats Reverse Sear',
    url: 'https://www.seriouseats.com/reverse-seared-steak-recipe',
    description: 'Technique-heavy with precise timing',
  },
  {
    id: 'bon-appetit-cookies',
    label: 'BA Brown Butter Cookies',
    url: 'https://www.bonappetit.com/recipe/brown-butter-and-toffee-chocolate-chip-cookies',
    description: 'Multi-step baking with make-ahead storage',
  },
  {
    id: 'kenji-fried-rice',
    label: 'Kenji\'s Fried Rice',
    url: 'https://www.seriouseats.com/easy-vegetable-fried-rice-recipe',
    description: 'Fast prep with mise en place critical',
  },
] as const;

/**
 * A simple pasted recipe text for users who don't want to use a URL
 */
export const EXAMPLE_TEXT = `Classic Beef Tacos

Serves: 4-6

Ingredients:
- 1 lb ground beef (80/20)
- 1 small onion, diced
- 3 cloves garlic, minced
- 2 tbsp chili powder
- 1 tsp cumin
- 1/2 tsp paprika
- Salt and pepper to taste
- 1/2 cup water
- 12 small corn tortillas
- Toppings: shredded lettuce, diced tomatoes, cheese, sour cream, cilantro

Instructions:
1. Heat a large skillet over medium-high heat. Add beef and cook, breaking it up, until browned (about 5-7 minutes).
2. Add onion and cook until softened, about 3 minutes.
3. Add garlic and cook for 30 seconds until fragrant.
4. Stir in chili powder, cumin, paprika, salt, and pepper.
5. Add water and simmer for 5 minutes until sauce thickens.
6. Warm tortillas in a dry skillet or microwave.
7. Serve beef in tortillas with desired toppings.

Storage: Cooked beef keeps refrigerated for 3-4 days. Reheat with a splash of water.`;
