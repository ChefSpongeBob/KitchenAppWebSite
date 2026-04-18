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
				RESEND_API_KEY?: string;
				RESEND_FROM_EMAIL?: string;
				RESEND_REPLY_TO_EMAIL?: string;
				APP_BASE_URL?: string;
				SMOKE_INTERNAL_TOKEN?: string;
				SMOKE_DEFAULT_EMAIL?: string;
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
