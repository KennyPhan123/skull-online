# Skull Online

A web-based multiplayer implementation of the Skull board game. Play online with 3-6 players.

## About the Game

Skull is a game of bluffing and deduction. Each player has a set of discs - three flowers and one skull. Players take turns placing discs face-down on their mat, then challenge each other to reveal flowers without hitting a skull.

## Live Demo

Play now at: https://skull-game-server.kennyphan123.partykit.dev

## Features

- Real-time multiplayer (3-6 players)
- Room-based gameplay with 4-letter room codes
- Interactive bid stepper controls
- Responsive design for desktop and mobile
- Original game artwork assets

## How to Play

1. **Create or Join a Game**: One player creates a room and shares the 4-letter code with friends.

2. **Placement Phase**: Each turn, place one disc face-down on your mat. After the first round, you can either add another disc or start a challenge.

3. **Challenge Phase**: Declare how many flower discs you believe you can reveal from all discs on the table. Other players can raise the bid or pass.

4. **Revelation Phase**: The challenger must reveal discs equal to their bid, starting with their own stack. If they reveal all flowers, they win the round. If they hit a skull, they lose a disc.

5. **Winning**: Win two rounds to win the game. Alternatively, be the last player with discs remaining.

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Build Tool**: Vite
- **Backend**: PartyKit (WebSocket server)
- **Hosting**: PartyKit

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
npx partykit deploy
```

## Project Structure

```
skull-online/
├── src/
│   ├── main.js      # Client-side game logic
│   ├── game.js      # Game state and utilities
│   └── styles.css   # Styling
├── party/
│   └── server.js    # PartyKit WebSocket server
├── public/
│   ├── coasters/    # Disc images
│   └── mats/        # Player mat images
├── index.html       # Main HTML file
├── vite.config.js   # Vite configuration
└── partykit.json    # PartyKit configuration
```

## Game Rules Reference

Based on the official Skull board game rules by Asmodee.

## License

This project is for educational purposes. Skull is a registered trademark of Asmodee.
