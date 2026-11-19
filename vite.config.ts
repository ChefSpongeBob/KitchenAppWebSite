import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const nativeBuild = process.env.NATIVE_BUILD === 'true';
const cloudflare = cloudflareAdapter();
const native = staticAdapter({ pages: 'mobile-dist', assets: 'mobile-dist', fallback: 'index.html', precompress: false, strict: false });
// Permit only the exact startup scripts shipped in app.html, including the static native fallback.
const startupScriptHashes = [...readFileSync('src/app.html', 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(([, script]) => `sha256-${createHash('sha256').update(script.replace(/\r\n?/g, '\n')).digest('base64')}` as const);

export default defineConfig(({ command }) => ({
  plugins: [sveltekit({
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'base-uri': ['self'],
        'object-src': ['none'],
        'frame-ancestors': ['none'],
        'img-src': ['self', 'data:', 'blob:', 'https:'],
        'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'script-src': ['self', 'https://challenges.cloudflare.com', ...startupScriptHashes],
        'connect-src': ['self', 'https://challenges.cloudflare.com', ...(nativeBuild ? ['https://criminiops.com'] as const : [])],
        'frame-src': ['https://challenges.cloudflare.com'],
        'media-src': ['self', 'blob:'],
        'form-action': ['self'],
        'upgrade-insecure-requests': command === 'build'
      }
    },
    // The request hook retains exact web/native origin validation.
    csrf: { trustedOrigins: ['*'] },
    version: { pollInterval: 0 },
    outDir: nativeBuild ? '.svelte-kit/native' : '.svelte-kit',
    adapter: nativeBuild
      // Use the official binding resolver while compiling the server graph for the native fallback.
      ? { ...native, vite: cloudflare.vite }
      : cloudflare
  })]
}));
