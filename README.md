# Central Roleplay Bot (CenteralBotVV2)

Discord bot for **Central Roleplay** (FiveM): tickets, moderation, welcome, giveaways, and live server status (FiveM + txAdmin).

## Features

- **Tickets** — General Support, Player Report, Donation Enquiry, Speak with Management
- **Moderation** — warn, mute, kick, ban, purge, lock/unlock, slowmode
- **Welcome** — auto member role + welcome embed
- **FiveM status** — `/status` and `/setupstatus` (auto-refresh embed; uses cfx.re API or direct `info.json`)

## Railway hosting

1. Create a **new Railway service** from this repo.
2. **Variables** — paste everything from your `.env` into Railway **Variables** (do not commit `.env` to git). Required at minimum:
   - `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`
   - Role/channel/category IDs (same as local `.env`)
   - Optional: `CFX_SERVER_ID`, `FIVEM_CONNECT`, `TXADMIN_URL`
3. **Build / start** — `railway.toml` runs `npm ci && npm run build`, then on each deploy **`releaseCommand`** registers slash commands (`deploy:build`), then **`npm start`** runs the bot.
4. **Persistent data** — tickets, warnings, and status-panel IDs live in SQLite/JSON under `data/`. Railway’s disk is ephemeral unless you add a **Volume** (e.g. mount at `/data`) and set **`DATA_DIR=/data`**.
5. **Health check** — Railway sets `PORT`; the bot responds with `200 OK` on `/` for platform checks.
6. After deploy, run **`/setuppanel`** and **`/setupstatus`** once in Discord if the release command succeeded but panels are missing.

Redeploy whenever you change env vars or code.

## Local setup

1. Copy `.env.example` to `.env`.
2. In the [Discord Developer Portal](https://discord.com/developers/applications), enable **Server Members Intent**.
3. Invite the bot with `applications.commands`, **Manage Roles**, and **Manage Channels**. Bot role must be **above** welcome/support roles.
4. `npm install`
5. `npm run deploy`
6. `npm run dev` or `npm run build && npm start`

## txAdmin

Set `TXADMIN_URL` to your panel base URL (optional). Status still works via cfx.re or your game port; txAdmin is used as an extra reachability check when configured.

Based on [AV-Bot](https://github.com/footie8778-hue/AV-Bot).
