import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';

const nativeBuild = process.env.NATIVE_BUILD === 'true';

export default {
  kit: {
    // Native Capacitor forms originate from localhost; hooks.server.ts enforces
    // same-origin or exact Crimini-native request validation for state changes.
    csrf: {
      trustedOrigins: ['*']
    },
    adapter: nativeBuild
      ? staticAdapter({
          pages: 'mobile-dist',
          assets: 'mobile-dist',
          fallback: 'index.html',
          precompress: false,
          strict: false
        })
      : cloudflareAdapter()
  }
};
