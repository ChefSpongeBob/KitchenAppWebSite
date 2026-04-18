# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --add prettier --install npm Kitchen-Software
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Mobile Release Notes

- Go-live checklist: `docs/mobile-go-live-checklist.md`
- iOS Mac handoff: `docs/ios-handoff-checklist.md`
- Deploy/rollback playbook: `docs/release-deploy-playbook.md`
- Manual auth smoke fallback: `docs/prod-auth-smoke-manual.md`
- Run release validation: `npm run mobile:check`
- Run Android release pass: `npm run android:release:check`
- Run production smoke pass: `npm run smoke:prod`
- Production smoke auth (preferred):
  - Env var: `SMOKE_INTERNAL_TOKEN`
  - Optional user selection: `SMOKE_EMAIL` (falls back to `SMOKE_DEFAULT_EMAIL` on server)
- Normalize migration tracking:
  - local: `npm run db:migrations:normalize:local`
  - remote: `npm run db:migrations:normalize:remote`
- Apply migrations:
  - local: `npm run db:migrations:apply:local`
  - remote: `npm run db:migrations:apply:remote`
- Camera beta flag:
  - Env var: `PUBLIC_CAMERA_BETA_ENABLED`
  - Truthy values: `1`, `true`, `yes`, `on`
  - Default behavior: disabled if unset
