# Skull Online

A web-based multiplayer implementation of the Skull board game. Play online with 3-6 players.

## Features

- **Real-time Multiplayer**: Supports 3-6 players seamlessly.
- **Room System**: Private rooms with 4-letter codes.
- **Turn Timer**: Configurable turn limits (15s, 20s, 25s, 30s) with **Auto-Play** logic for AFK players.
    - *Auto-Place/Challenge*: If time runs out during placement.
    - *Auto-Pass*: If time runs out during bidding.
    - *Auto-Reveal / Card Loss*: If time runs out during card loss / first player choice.
- **Personal History**: Track your own placed cards (Skull/Flower) in the bottom-left corner.
- **Responsive HUD**: Text-only, pastel-themed HUD positioned flush to corners for maximum visibility.
- **Smart Logic**:
    - Auto-revelation triggering when max bid is reached.
    - Z-index management to prevent overlapping in 6-player games.
- **Assets**: Uses original game artwork.

## How to Play

1. **Create or Join a Game**: One player creates a room and shares the 4-letter code.
2. **Placement Phase**: Place one disc face-down. First round requires one disc; subsequent rounds allow adding more or starting a challenge.
3. **Challenge Phase**: Bid how many flowers you can reveal. Highest bidder becomes the Challenger.
4. **Revelation Phase**: Reveal discs equal to your bid.
    - Must reveal all your own discs first.
    - Then reveal other players' discs one by one.
    - **Flower**: Good! Continue revealing.
    - **Skull**: Bad! You lose one disc.
5. **Winning**: Win 2 challenges to win the game. Or be the last survivor.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Pastel Theme)
- **Build Tool**: Vite
- **Backend/Hosting**: Cloudflare Workers + Durable Objects (`partyserver` & `partysocket`)

## Local Development

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
# Install dependencies
npm install

# Run Cloudflare Worker + static site locally (http://localhost:8787)
npm run dev:worker

# (Optional) Run Vite HMR dev server on http://localhost:3000 (proxies /parties to :8787)
npm run dev
```

### Build

```bash
npm run build
```

### Deploy to Cloudflare Workers

```bash
# Authenticate with Cloudflare (first time only)
npx wrangler login

# Build frontend and deploy Worker + Durable Objects + Static Assets
npm run deploy
```

> **Note:** By default, the frontend connects to the same origin (`window.location.host`), which works out-of-the-box when deployed together on Cloudflare Workers (`https://skull.<your-subdomain>.workers.dev` or custom domain). If you deploy the frontend separately (e.g. Cloudflare Pages / Vercel), set `VITE_PARTY_HOST=skull.<your-subdomain>.workers.dev` at build time.

## Project Structure

```
skull-online/
├── src/
│   ├── game.js       # Game constants, positions & client state class
│   ├── main.js       # Client-side game logic & UI rendering
│   └── styles.css    # Main stylesheet (Pastel theme, Animations)
├── party/
│   └── server.js     # Cloudflare Worker + PartyServer Durable Object
├── public/
│   ├── coasters/     # Disc images
│   └── mats/         # Player mat images
├── index.html        # Entry point
├── vite.config.js    # Vite config
└── wrangler.jsonc    # Cloudflare Workers & Durable Objects config
```

## License

This project is for educational purposes. Skull is a registered trademark of Asmodee.
