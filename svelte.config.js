import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';

const nativeBuild = process.env.NATIVE_BUILD === 'true';

export default {
  kit: {
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
