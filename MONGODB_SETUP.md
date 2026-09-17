# MongoDB setup for PetLuck

PetLuck uses MongoDB for standalone player practice profiles. Each profile stores:

- practice-gem balance
- opened case inventory
- recent game history

## Connect Atlas to Render

1. Create a MongoDB Atlas project and a free shared cluster.
2. Create a database user with a long unique password.
3. In Atlas, add a network rule that permits Render to connect. For early setup, `0.0.0.0/0` works, but restrict this when you have Render's fixed outbound IPs.
4. Copy the **Node.js connection string** from Atlas. Replace the password placeholder locally; never commit that final string to GitHub.
5. In Render, open the PetLuck service → **Environment** and add:

   - `MONGODB_URI` — the complete Atlas connection string
   - `MONGODB_DB` — `petluck`

6. Save the variables and deploy the latest commit.

The site shows **MongoDB-backed practice data** in the top bar once the connection is successful.

## Protect the admin center

In the same Render **Environment** page, add two secret values:

- `ADMIN_USERNAME` — your chosen admin sign-in name
- `ADMIN_PASSWORD` — a long unique password

Save and redeploy. The `/Admin` screen will require these credentials and creates an eight-hour secure server session. Neither value is included in GitHub or sent to the browser until you submit the sign-in form.

## Before public balances

The current database feature persists practice data. Do not use it for deposits, cash-out, or anything with real-world value yet. The production phase must move every game action to verified server-side transactions, add account authorization, and lock the admin area to designated owners.
