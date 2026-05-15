import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { AppFeatureModes } from './lib/features/appFeatures';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				CAMERA_MEDIA?: R2Bucket;
				DOC_MEDIA?: R2Bucket;
				RESEND_API_KEY?: string;
				RESEND_FROM_EMAIL?: string;
				RESEND_REPLY_TO_EMAIL?: string;
				APP_BASE_URL?: string;
				SMOKE_INTERNAL_TOKEN?: string;
				SMOKE_DEFAULT_EMAIL?: string;
				ALLOW_RUNTIME_SCHEMA_MUTATION?: string;
				APP_STORE_BUNDLE_ID?: string;
				APP_STORE_ISSUER_ID?: string;
				APP_STORE_KEY_ID?: string;
				APP_STORE_PRIVATE_KEY?: string;
				APP_STORE_ENVIRONMENT?: string;
				GOOGLE_PLAY_PACKAGE_NAME?: string;
				GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?: string;
				BILLING_WEBHOOK_TOKEN?: string;
			};
		}

		interface Locals {
			DB: D1Database;
			MEDIA_BUCKET?: R2Bucket;
			userId?: string;
			userRole?: string;
			featureModes?: AppFeatureModes;
			businessId?: string;
			businessName?: string;
			businessLogoUrl?: string | null;
			businessSlug?: string;
			businessPlan?: string;
			businessRole?: string;
			businessOnboardingComplete?: boolean;
		}
	}
}

export {};
