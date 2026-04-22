export const TERM_GROUPS = {
  bullish: [
    'breakout', 'beat', 'beats', 'growth', 'upside', 'outperform', 'bullish', 'rally',
    'expansion', 'surge', 'acceleration', 'upgrade', 'strong', 'record', 'momentum',
    'resilient', 'profitability', 'tailwind', 'innovation', 'rebound', 'accumulate', 'buy',
    'advancer', 'risk-on', 'green'
  ],
  bearish: [
    'downgrade', 'miss', 'missed', 'decline', 'drawdown', 'bearish', 'selloff', 'contraction',
    'guidance-cut', 'warning', 'weak', 'headwind', 'default', 'debt', 'overvalued',
    'lawsuit', 'fraud', 'recession', 'slowdown', 'loss', 'panic', 'sell',
    'risk-off', 'red', 'drawdown'
  ],
  uncertainty: [
    'uncertain', 'volatile', 'risk', 'speculative', 'unpredictable', 'possible', 'may',
    'could', 'unclear', 'concern', 'concerns', 'mixed', 'unknown', 'question', 'doubt'
  ],
  valuation: [
    'undervalued', 'discount', 'cheap', 'premium', 'multiple', 'valuation', 'pe', 'ev',
    'ebitda', 'cashflow', 'free-cash-flow', 'book-value', 'intrinsic', 'price-target'
  ],
  macroRisk: [
    'inflation', 'rates', 'fed', 'yield', 'tariff', 'policy', 'geopolitical', 'sanction',
    'currency', 'liquidity', 'credit', 'default-risk', 'employment', 'gdp', 'vix', 'volatility-index'
  ],
  catalyst: [
    'earnings', 'guidance', 'launch', 'partnership', 'approval', 'acquisition', 'buyback',
    'dividend', 'roadmap', 'contract', 'renewal', 'merger', 'spin-off'
  ],
  crowding: [
    'hype', 'meme', 'viral', 'retail', 'fomo', 'short-squeeze', 'crowded', 'consensus',
    'reddit', 'x', 'tweet', 'thread', 'upvote', 'comments'
  ]
};

export const FEATURE_KEYS = [
  'bullishSignal',
  'bearishSignal',
  'uncertaintySignal',
  'valuationSignal',
  'macroRiskSignal',
  'catalystSignal',
  'crowdingSignal',
  'sentimentSkew',
  'volatilitySignal',
  'densitySignal'
];

export const DEFAULT_MODEL_WEIGHTS = {
  buy: {
    bullishSignal: 1.45,
    bearishSignal: -1.6,
    uncertaintySignal: -0.8,
    valuationSignal: 0.65,
    macroRiskSignal: -0.45,
    catalystSignal: 0.75,
    crowdingSignal: -0.2,
    sentimentSkew: 1.4,
    volatilitySignal: -0.55,
    densitySignal: 0.2,
    bias: -0.08
  },
  sell: {
    bullishSignal: -1.35,
    bearishSignal: 1.55,
    uncertaintySignal: 0.65,
    valuationSignal: -0.45,
    macroRiskSignal: 0.55,
    catalystSignal: -0.25,
    crowdingSignal: 0.5,
    sentimentSkew: -1.45,
    volatilitySignal: 0.75,
    densitySignal: 0.1,
    bias: -0.02
  },
  hold: {
    bullishSignal: -0.35,
    bearishSignal: -0.35,
    uncertaintySignal: 0.95,
    valuationSignal: 0.25,
    macroRiskSignal: 0.25,
    catalystSignal: -0.2,
    crowdingSignal: -0.1,
    sentimentSkew: -0.15,
    volatilitySignal: 0.35,
    densitySignal: 0.45,
    bias: 0.2
  }
};

export const MODEL_LABELS = ['buy', 'sell', 'hold'];
