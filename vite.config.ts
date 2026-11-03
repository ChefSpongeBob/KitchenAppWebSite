import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';

const nativeBuild = process.env.NATIVE_BUILD === 'true';
const cloudflare = cloudflareAdapter();
const native = staticAdapter({ pages: 'mobile-dist', assets: 'mobile-dist', fallback: 'index.html', precompress: false, strict: false });

export default defineConfig({
  plugins: [sveltekit({
    // The request hook retains exact web/native origin validation.
    csrf: { trustedOrigins: ['*'] },
    version: { pollInterval: 0 },
    outDir: nativeBuild ? '.svelte-kit/native' : '.svelte-kit',
    adapter: nativeBuild
      // Use the official binding resolver while compiling the server graph for the native fallback.
      ? { ...native, vite: cloudflare.vite }
      : cloudflare
  })]
});
