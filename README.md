# qmVP

Quantative Market Vector Pulls (`qmVP`) is a machine-learning market signal engine that ingests live X sentiment, Reddit sentiment, and market quote status, then outputs decision-grade `buy` / `sell` / `hold` vectors.

## Live Features

<img width="1507" height="855" alt="image" src="https://github.com/user-attachments/assets/31c1b8ca-1f5d-4fcd-ac5d-4aeb6c147f70" />


- Auto-scrapes live sentiment from X (API when `X_BEARER_TOKEN` is set, scrape fallback otherwise)
- Auto-scrapes live Reddit `hot` posts from your selected subreddit
- Pulls live market quote snapshots (SPY/QQQ/DIA/IWM/VIX by default)
- Merges all feeds into a feature vector and returns:
  - decision label (`buy` / `sell` / `hold`)
  - probability distribution
  - full feature vector
  - top contributing features
  - feed health by source (status, latency, item count)
- Auto-refresh intervals in the UI: `1s`, `10s`, `1m`, `5m`, `10m`, `1h`

## Quickstart

```bash
npm run build
npm start
```

Open [http://localhost:4309](http://localhost:4309).

## Scripts

- `npm run build` -> builds distributable files into `dist/`
- `npm start` -> runs the built app (`dist/server.js`)
- `npm run dev` -> runs from source (`src/server.js`)

## API

### Health

```http
GET /api/health
```

### Pull Single URL (legacy)

```http
GET /api/pull?url=https://example.com/market-news
```

### Pull Live Market Vector (X + Reddit + Market)

```http
POST /api/pull/live
Content-Type: application/json

{
  "query": "(stocks OR market OR earnings OR fed OR inflation) lang:en",
  "subreddit": "stocks",
  "symbols": ["SPY", "QQQ", "DIA", "IWM", "^VIX"],
  "xLimit": 8,
  "redditLimit": 8,
  "timeoutMs": 12000
}
```

Alias endpoint also supported:

```http
GET /api/live-pull
```

### Train Model From Label (legacy URL mode)

```http
POST /api/train
Content-Type: application/json

{
  "url": "https://example.com/market-news",
  "label": "buy"
}
```

### Model Summary

```http
GET /api/model
```

## Environment

- `PORT` (optional): defaults to `4309`
- `X_BEARER_TOKEN` (optional): enables direct X API pulls before fallback scraping

## Notes

- This system is informational software and not financial advice.
- If X API credentials are not configured, qmVP automatically attempts scrape fallback mode.
