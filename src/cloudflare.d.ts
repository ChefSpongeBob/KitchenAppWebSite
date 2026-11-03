declare module 'cloudflare:workers' {
  export const env: App.RuntimeEnv;
  export const waitUntil: import('@cloudflare/workers-types').ExecutionContext['waitUntil'];
}
