# Discord login deployment

GitHub Pages only hosts the public website. Run the `server/` service on a private Node host such as Render, Railway, or Fly.io.

## Environment variables

Set these in the host's secret/environment-variable panel. Do not commit them.

- `DISCORD_CLIENT_ID`: Discord Developer Portal → OAuth2 → General.
- `DISCORD_CLIENT_SECRET`: Discord Developer Portal → OAuth2 → Reset Secret. Keep this private.
- `DISCORD_REDIRECT_URI`: exactly `https://YOUR-API-DOMAIN/auth/discord/callback`.
- `WEB_ORIGIN`: `https://birbot20.github.io/petluck.org` while testing, or your eventual custom website domain.
- `SESSION_SECRET`: a newly generated random string of at least 32 characters.
- `NODE_ENV`: `production`.

## Discord Developer Portal

Create an application, open **OAuth2**, and add the same callback URL under **Redirects**. The login service only asks Discord for the `identify` permission. It does not receive or expose the bot token.

## Start command

```
npm install
npm run server
```

After deployment, set `VITE_API_URL` to the API's HTTPS address when building the front end. For GitHub Pages, place it in the Pages workflow's build environment and redeploy.
