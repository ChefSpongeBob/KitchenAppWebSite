export const recipeCategories = [] as const;

export function normalizeRecipeCategory(value: string): string {
	return value.trim().toLowerCase();
}

export function isValidRecipeCategory(value: string): boolean {
	return normalizeRecipeCategory(value).length > 0;
}
