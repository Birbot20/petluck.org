# PetLuck Web

A React/Vite web experience for the PetLuck Discord community.

## Current foundation

- Responsive dark PetLuck interface
- Landing dashboard for balance, rewards, activity, games, and PvP
- Public, non-sensitive API integration point via `VITE_API_URL`
- Clear web/API contract for connecting to the existing Python Discord bot
- Automatic GitHub Pages deployment on every update to `main`

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_URL` when the protected API bridge is deployed.

## Important

The site intentionally does **not** expose balances, deposits, withdrawals, or game actions until Discord authentication and server-side authorization are installed. The next build stage is a secure API bridge in the Python bot plus Discord OAuth on the web backend.
