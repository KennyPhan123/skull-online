# Skull Online

A web-based multiplayer implementation of the Skull board game. Play online with 3-6 players.

## Live Demo

Play now at: **https://skull.kennyphan123.partykit.dev**

## Features

- **Real-time Multiplayer**: Supports 3-6 players seamlessly.
- **Room System**: Private rooms with 4-letter codes.
- **Turn Timer**: Configurable turn limits (30s, 60s, etc.) with **Auto-Play** logic for AFK players.
    - *Auto-Place/Challenge*: If time runs out during placement.
    - *Auto-Pass*: If time runs out during bidding.
    - *Auto-Reveal*: If time runs out during revelation.
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
- **Backend/Hosting**: PartyKit (WebSocket Serverless)

## Local Development

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run PartyKit dev server (for multiplayer)
npx partykit dev
```

### Build

```bash
npm run build
```

### Deploy

```bash
# Deploy to PartyKit (Project name: skull)
npx partykit deploy
```

## Project Structure

```
skull-online/
├── src/
│   ├── main.js      # Client-side game logic & UI rendering
│   └── styles.css   # Main stylesheet (Pastel theme, Animations)
├── party/
│   └── server.js    # PartyKit server (Game state, Timer, Auto-play)
├── public/
│   ├── coasters/    # Disc images
│   └── mats/        # Player mat images
├── index.html       # Entry point
├── vite.config.js   # Vite config
└── partykit.json    # PartyKit config (Project: skull)
```

## License

This project is for educational purposes. Skull is a registered trademark of Asmodee.
