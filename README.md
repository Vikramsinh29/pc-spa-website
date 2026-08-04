# PC SPA Web

Next.js 16 App Router site deployed to Cloudflare Workers with the OpenNext adapter. Cloudflare Pages can use the same Wrangler-managed project and domain; the Worker target is required for server-rendered routes and `/api/health`.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Cloudflare setup

1. Authenticate Wrangler with `npx wrangler login`.
2. Create the D1 database:

   ```bash
   npx wrangler d1 create pcspa
   ```

3. Replace `replace-with-d1-database-id` in `wrangler.toml` with the returned database ID.
4. Configure the Cloudflare Pages/Workers project name as `pc-spa-web` and attach the production domain `getpcspa.com`.
5. Set `SITE_URL`, `CLOUDFLARE_ENV`, and `D1_DATABASE_NAME` as non-secret variables in the deployment environment when overriding the checked-in defaults. Set the licensing token secret with:

   ```bash
   npx wrangler secret put LICENSE_TOKEN_SECRET
   ```

   Use a randomly generated value of at least 32 characters. Never commit this secret or log activation keys, session tokens, email addresses, or device fingerprints.

   Configure `ADMIN_USER_IDS` as a comma-separated non-secret variable containing the user IDs permitted to issue licenses through `/api/admin/licenses/issue`.

## Preview and deploy

Build the Next.js app for Cloudflare and preview it with Wrangler:

```bash
npm run cloudflare:build
npm run cloudflare:dev
```

Deploy the Worker and its static assets:

```bash
npm run cloudflare:build
npm run cloudflare:deploy
```

The D1 binding is reserved as `DB`. No migrations are included in Sprint 1; add versioned SQL files under `migrations/` before introducing database-backed features.
