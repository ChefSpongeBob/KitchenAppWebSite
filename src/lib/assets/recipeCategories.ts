export const recipeCategories = ['kitchen', 'sushi', 'sushiprep', 'sauces', 'specials'] as const;

export function normalizeRecipeCategory(value: string): string {
	return value.trim().toLowerCase();
}

export function isValidRecipeCategory(value: string): boolean {
	return (recipeCategories as readonly string[]).includes(normalizeRecipeCategory(value));
}
