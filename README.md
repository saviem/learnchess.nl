# LearnChess.nl — Grandmaster AI

Leer schaken tegen een AI-bot met realtime coaching in het Nederlands.

## Features

- Drie moeilijkheidsniveaus: Beginner, Gevorderd, Professional
- Schaken als wit tegen Stockfish
- Coach-feedback in een speech bubble na elke zet
- OpenAI-gegenereerde uitleg (met fallback zonder API-key)
- Geen login — direct spelen
- Mobiel-first design

## Starten

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Voeg je OpenAI API-key toe in `.env.local`:

```
OPENAI_API_KEY=sk-...
```

Open [http://localhost:3000](http://localhost:3000).

## Tech stack

- Next.js 16 + TypeScript + Tailwind CSS v4
- chess.js + react-chessboard
- Stockfish WASM (lite single-threaded)
- OpenAI GPT-4o-mini voor coach-teksten
