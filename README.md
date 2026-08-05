# Ranked Queue Discord Bot — Full Setup Guide

A Discord bot that manages a 4-player ranked queue:

- `/rankqueue` — join the queue. **Whoever starts a new queue (first to join
  after it was empty) automatically becomes the Captain.**
- `/rankleave` — leave the queue (if the captain leaves, captaincy passes to
  the next person in queue)
- `/rankabort` — cancel the current forming queue (**captain or server admin only**)
- `/rankstart` — force-start with whoever's in queue (min 2), even if fewer
  than 4 (**captain or server admin only**)
- `/rankend` (alias: `/rankfinish`) — end the current game (**team leader or server admin only**)
- `/rankstatus` — see who's queued / who's playing, and who the captain is (bonus command)

When the 4th player joins with `/rankqueue`, the bot **automatically** posts
the team lineup with the **queue captain as team leader** — no random
selection. Only that leader, or a member with "Manage Server" permission, can
abort, force-start, or finish (`/rankend`) the queue/game.

---

## 1. Create the Discord Bot Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and log in.
2. Click **New Application**, name it (e.g. "Rank Queue Bot"), and create it.
3. In the left sidebar, open **Bot**.
   - Click **Reset Token** / **Copy** to get your bot token. Save it somewhere safe — you'll need it as `DISCORD_TOKEN`. **Never share this token or commit it to GitHub.**
   - Turn **off** any Privileged Gateway Intents — this bot doesn't need them (Message Content, Presence, Server Members).
4. In the left sidebar, open **OAuth2 → General**. Copy the **Client ID** — you'll need it as `CLIENT_ID`.
5. Still under **OAuth2 → URL Generator**:
   - Scopes: check `bot` and `applications.commands`.
   - Bot Permissions: check `Send Messages`, `Embed Links`, `Read Message History`, `Mention Everyone` (used for the `@here` start ping — optional, uncheck if you don't want that).
   - Copy the generated URL, open it in your browser, and invite the bot to your server.

---

## 2. Get the Code Running Locally (recommended first)

**Requirements:** [Node.js 18+](https://nodejs.org)

```bash
# 1. Unzip/clone the project, then inside the folder:
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env
```

Edit `.env`:

```
DISCORD_TOKEN=your-bot-token-here
CLIENT_ID=your-application-client-id-here
GUILD_ID=your-test-server-id-here   # optional but recommended while testing
```

> **Finding your Guild ID:** In Discord, enable Developer Mode (User Settings →
> Advanced), then right-click your server icon → **Copy Server ID**.
> Setting `GUILD_ID` makes slash commands appear **instantly** in that one
> server instead of waiting up to an hour for global registration.

Register the slash commands, then start the bot:

```bash
npm run deploy-commands
npm start
```

You should see `Logged in as YourBot#1234...` in the console. In your Discord
server, type `/rankqueue` — it should show up as a slash command.

---

## 3. How the Game Flow Works

1. The first player to run `/rankqueue` after the queue is empty becomes the
   **Captain** for that queue. Everyone else who joins after them is just a
   regular queue member.
2. The moment the **4th** player joins, the bot automatically:
   - Sets the **Captain** as the **Team Leader** for the game (no random pick).
   - Posts an embed listing all 4 players and the leader.
   - Clears the queue so a new one can start.
3. If you don't want to wait for a full 4, the **captain** (or a server
   admin) can run `/rankstart` to force-start immediately with whoever is
   currently queued (minimum 2 by default — edit `MIN_FORCE_START` in
   `index.js` to change this). Non-captains/non-admins get an error if they
   try.
4. The **captain** (or a server admin) can also run `/rankabort` at any time
   before the game starts to cancel the queue entirely and clear it out.
5. While a game is active, `/rankqueue` is locked (players are told to wait)
   so two games can't overlap in the same server.
6. When the match is over, the **team leader** (i.e. the original captain,
   or a server admin) runs `/rankend` (or its alias `/rankfinish` — both do
   exactly the same thing). This closes the game and reopens the queue.
7. If the captain leaves the queue with `/rankleave` before the game starts,
   captaincy automatically passes to the next player in line. If everyone
   leaves, the queue resets with no captain.
8. `/rankstatus` can be run any time to check current queue/game state and
   see who the captain/leader is.

**Note on scope:** the bot currently tracks **one queue per Discord server**
(not per-channel). If you want separate queues per channel, see the
"Customizing" section below.

---

## 4. Deploying for Free (so it runs 24/7 without your PC)

Running `npm start` on your laptop only keeps the bot online while your
laptop is on. **The easiest reliable path is GitHub + Render**, detailed
below step by step. Other options follow after.

### ⭐ Easiest: GitHub + Render (recommended)

**Step 1 — Put the code on GitHub (don't upload the zip itself — GitHub needs individual files)**

1. Unzip `discord-rank-queue-bot.zip` on your computer. You should see
   `index.js`, `deploy-commands.js`, `package.json`, `.gitignore`, `README.md`,
   `.env.example`.
2. Go to [github.com](https://github.com) and sign up/log in (free).
3. Click the **+** in the top right → **New repository**. Name it e.g.
   `rank-queue-bot`. Leave it empty (no README/gitignore template needed —
   we already have one). Click **Create repository**.
4. On the new repo's page, click **uploading an existing file** (or **Add
   file → Upload files**).
5. Drag in the *unzipped* files/folder — `index.js`, `deploy-commands.js`,
   `package.json`, `.gitignore`, `README.md`, `.env.example`.
   **Do NOT upload a real `.env` file with your actual token** — only
   `.env.example` should ever be on GitHub.
6. Scroll down, click **Commit changes**.

**Step 2 — Connect Render to that repo**

1. Go to [render.com](https://render.com) and sign up — choose **"Sign up
   with GitHub"**, it's the fastest and auto-links your account.
2. Click **New +** → **Web Service**.
3. Pick your `rank-queue-bot` repository from the list and click **Connect**.
4. Fill in the settings:
   - **Name:** anything, e.g. `rank-queue-bot`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm run deploy-commands && npm start`
   - **Instance Type:** Free
5. Under **Environment Variables**, click **Add Environment Variable** and add:
   - `DISCORD_TOKEN` = your bot token
   - `CLIENT_ID` = your application's client ID
   - `GUILD_ID` = your test server ID (optional, but makes commands appear instantly)
6. Click **Create Web Service**. Render will install dependencies, register
   your slash commands, and start the bot automatically. Watch the **Logs**
   tab — you should see `Logged in as YourBot#1234...`.
7. Go to Discord and try `/rankqueue` — it should work.

**Step 3 — Keep it from sleeping**

Render's free Web Services sleep after ~15 minutes with no HTTP traffic
(this bot's built-in keep-alive server gives Render something to ping so it
counts as "alive"). To stop it sleeping entirely:

1. Copy the URL Render gave your service, e.g. `https://rank-queue-bot.onrender.com`.
2. Sign up free at [uptimerobot.com](https://uptimerobot.com).
3. **Add New Monitor** → type **HTTP(s)** → paste your Render URL → set the
   check interval to every 5 minutes → save.

That's it — UptimeRobot pings your bot every 5 minutes, keeping it awake
24/7, all on free tiers.

**Updating the bot later:** whenever you change the code, just re-upload the
changed file(s) on GitHub (or `git push` if you clone it locally with the
GitHub Desktop app/Git CLI) — Render automatically redeploys on every commit.

---

### Other free options

The rest of these work too, roughly in order of ease vs. reliability:

### Option A — Replit + UptimeRobot (no GitHub needed at all)

1. Go to [replit.com](https://replit.com), create a new **Node.js** Repl, and
   upload/paste in this project's files (`index.js`, `deploy-commands.js`,
   `package.json`).
2. In Replit, open the **Secrets** tab (padlock icon) and add `DISCORD_TOKEN`,
   `CLIENT_ID`, and optionally `GUILD_ID` — **do not** put these in a visible
   `.env` file on a public Repl.
3. Add a secret `PORT` = `3000` (the bot's built-in Express keep-alive server
   uses this so Replit sees an open port).
4. In the Replit Shell, run `npm run deploy-commands` once, then set the
   **Run** command to `npm start`.
5. Click **Run**. Replit will give you a public URL like
   `https://your-repl-name.username.repl.co`.
6. Free Repls go to sleep after inactivity. To keep it alive 24/7, sign up at
   [uptimerobot.com](https://uptimerobot.com) (free) and add an **HTTP(s)
   monitor** that pings your Repl URL every 5 minutes.

### Option B — A Discord-bot-specific free host (no keep-alive tricks needed)

Hosts built specifically for Discord bots (e.g. **Bot-Hosting.net**,
**Wispbyte**) offer free tiers that stay online without you needing an
UptimeRobot pinger:

1. Sign up and create a new **Node.js** service.
2. Upload your project folder (or connect the GitHub repo).
3. Set the startup command to `npm install && npm run deploy-commands && npm start`.
4. Add `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` as environment
   variables/secrets in their panel.
5. Start the bot from their dashboard.

These free tiers are usually limited in RAM/CPU (fine for a queue bot) and
sometimes require periodic manual renewal — check the specific host's terms.

### Option C — Oracle Cloud Free Tier (most reliable, more setup)

Oracle's "Always Free" tier gives a small VM that never expires and never
sleeps — the most robust free option if you're comfortable with basic Linux:

1. Create an Always Free VM instance (Ubuntu) at
   [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
2. SSH in, install Node.js 18+ (`curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs`).
3. Upload your project (via `git clone` or `scp`), then:
   ```bash
   npm install
   npm run deploy-commands
   ```
4. Keep it running permanently with a process manager:
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name rank-queue-bot
   pm2 save
   pm2 startup   # follow the printed instructions so it survives reboots
   ```

---

## 5. Customizing

All the tunable behavior lives at the top of `index.js`:

```js
const MAX_PLAYERS = 4;       // change team size that auto-starts a game
const MIN_FORCE_START = 2;   // minimum players /rankstart requires
```

Other easy tweaks:
- **Per-channel queues instead of per-server:** change `getState(interaction.guildId)`
  to `getState(interaction.channelId)` everywhere.
- **Allow anyone to force-start/abort/end, not just the captain:** remove the
  `isCaptainOrAdmin(...)` checks in the relevant command blocks.
- **Remove the `@here` ping** on game start: delete `'@here '` from the
  `interaction.channel.send(...)` call in `startGame()`.
- **Persist the queue across restarts:** the current version stores state in
  memory (`Map`), so a restart clears any active queue/game. For persistence,
  swap the `Map` for reads/writes to a small JSON file or a database
  (SQLite/Postgres) — ask if you'd like this added.

---

## 6. Troubleshooting

- **Slash commands don't show up:** make sure you ran `npm run deploy-commands`
  after setting `CLIENT_ID` (and `GUILD_ID` for instant testing). Global
  commands (no `GUILD_ID`) can take up to an hour to appear.
- **"Used disallowed intents" error on login:** double check you didn't enable
  any Privileged Gateway Intents in the Developer Portal that aren't requested
  in `index.js` (this bot only needs `Guilds`, no privileged intents).
- **Bot goes offline after a while on a free host:** that host's free tier is
  likely sleeping the app — see the UptimeRobot step in Option C, or move to
  a Discord-bot-specific host (Option B) or Oracle Free Tier (Option D).
