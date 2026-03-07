import type { D1Database } from '@cloudflare/workers-types';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				IOT_API_KEY?: string;
			};
		}

		interface Locals {
			DB: D1Database;
			userId?: string;
			userRole?: string;
		}
	}
}

export {};
