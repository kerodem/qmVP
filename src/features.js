import { FEATURE_KEYS, TERM_GROUPS } from './lexicon.js';
import { tokenize, topSentences } from './text.js';
import { clamp } from './utils.js';

const TERM_SET = Object.fromEntries(
  Object.entries(TERM_GROUPS).map(([key, terms]) => [key, new Set(terms)])
);

function termHitRate(tokens, termKey) {
  const set = TERM_SET[termKey];
  if (!set || tokens.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const token of tokens) {
    if (set.has(token)) {
      hits += 1;
    }
  }

  return hits / tokens.length;
}

function detectVolatility(tokens, rawText) {
  const percentTokens = tokens.filter((token) => token.includes('%')).length;
  const volatilityWords = tokens.filter((token) => ['volatility', 'swing', 'whipsaw', 'choppy'].includes(token)).length;
  const bigMoveMentions = (rawText.match(/\b\d{1,2}(?:\.\d+)?%\b/g) || []).length;

  return clamp((percentTokens * 0.06) + (volatilityWords * 0.08) + (bigMoveMentions * 0.05), 0, 1);
}

function densitySignal(tokens) {
  const financeTerms = Object.values(TERM_GROUPS).flat();
  const financeSet = new Set(financeTerms);

  let hits = 0;
  for (const token of tokens) {
    if (financeSet.has(token)) {
      hits += 1;
    }
  }

  const ratio = tokens.length === 0 ? 0 : hits / tokens.length;
  return clamp(ratio * 8, 0, 1);
}

export function buildFeatureVector(text) {
  const tokens = tokenize(text);

  const bullish = termHitRate(tokens, 'bullish');
  const bearish = termHitRate(tokens, 'bearish');
  const uncertainty = termHitRate(tokens, 'uncertainty');
  const valuation = termHitRate(tokens, 'valuation');
  const macroRisk = termHitRate(tokens, 'macroRisk');
  const catalyst = termHitRate(tokens, 'catalyst');
  const crowding = termHitRate(tokens, 'crowding');

  const sentimentSkew = clamp((bullish - bearish) * 8, -1, 1);
  const volatilitySignal = detectVolatility(tokens, text);
  const density = densitySignal(tokens);

  const vector = {
    bullishSignal: clamp(bullish * 12, 0, 1),
    bearishSignal: clamp(bearish * 12, 0, 1),
    uncertaintySignal: clamp(uncertainty * 12, 0, 1),
    valuationSignal: clamp(valuation * 14, 0, 1),
    macroRiskSignal: clamp(macroRisk * 12, 0, 1),
    catalystSignal: clamp(catalyst * 12, 0, 1),
    crowdingSignal: clamp(crowding * 14, 0, 1),
    sentimentSkew,
    volatilitySignal,
    densitySignal: density
  };

  for (const key of FEATURE_KEYS) {
    if (!Number.isFinite(vector[key])) {
      vector[key] = 0;
    }
  }

  return {
    vector,
    tokenCount: tokens.length,
    previewSentences: topSentences(text, 3)
  };
}
