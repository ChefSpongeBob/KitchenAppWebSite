import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				IOT_API_KEY?: string;
				CAMERA_MEDIA?: R2Bucket;
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
