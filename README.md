# qmVP

Quantative Market Vector Pulls (`qmVP`) is a lightweight machine-learning pipeline that scrapes HTML from market-related pages and converts textual signals into decision-grade `buy` / `sell` / `hold` vectors for retail investor workflows.

## What It Does

- Scrapes raw HTML from a target webpage
- Converts HTML to normalized text
- Extracts market-oriented feature signals (bullish/bearish pressure, macro risk, catalyst density, volatility)
- Scores the feature vector through a multiclass linear model
- Returns:
  - `decision.label` (`buy`, `sell`, `hold`)
  - probability distribution
  - full feature vector
  - top contributing features
- Supports lightweight online training updates via supervised feedback

## Quickstart

```bash
npm run build
npm run start
```

Then open:

- [http://localhost:4309](http://localhost:4309)

## Scripts

- `npm run build` -> builds distributable files into `dist/`
- `npm run start` -> runs the built app (`dist/server.js`)
- `npm run dev` -> runs from source (`src/server.js`)

## API

### Health

```http
GET /api/health
```

### Pull Market Vector

```http
GET /api/pull?url=https://example.com/market-news
```

### Train Model From Label

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

## Terminal UI

The UI is intentionally terminal-like and code-first:

- command prompt style pull/train controls
- vector matrix and top feature contribution panes
- runtime log stream with timestamped events
- CRT-inspired visual treatment

## Notes

- Only `http` and `https` targets are accepted.
- The baseline model is heuristic-initialized and improves with incremental labels through `/api/train`.
- This project is informational software and not financial advice.
