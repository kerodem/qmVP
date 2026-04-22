import { htmlToText } from './text.js';
import { toSafeNumber } from './utils.js';

const DEFAULT_MARKET_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX'];
const DEFAULT_QUERY = '(stocks OR market OR earnings OR fed OR inflation) lang:en';
const DEFAULT_SUBREDDIT = 'stocks';

function toIsoNow() {
  return new Date().toISOString();
}

function clampInt(value, min, max, fallback) {
  const candidate = Math.round(toSafeNumber(value, fallback));
  return Math.min(max, Math.max(min, candidate));
}

function normalizeCsvList(rawValue, fallback = []) {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  if (typeof rawValue !== 'string') {
    return [...fallback];
  }

  const normalized = rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeToken(rawValue, fallback) {
  const text = String(rawValue ?? '').trim();
  if (!text) {
    return fallback;
  }

  return text.replace(/[^a-z0-9_\- ]/gi, '').trim() || fallback;
}

function normalizeSymbols(rawSymbols) {
  const symbols = normalizeCsvList(rawSymbols, DEFAULT_MARKET_SYMBOLS)
    .map((symbol) => symbol.toUpperCase())
    .map((symbol) => (symbol === 'VIX' ? '^VIX' : symbol))
    .filter((symbol) => /^[A-Z0-9^.\-]{1,16}$/.test(symbol));

  return symbols.length > 0 ? symbols : [...DEFAULT_MARKET_SYMBOLS];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractFeedLines(rawText, maxItems = 10) {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 24)
    .filter((line) => !/^(image|video|ad|sign in|log in)$/i.test(line))
    .filter((line) => !/^(title:|url source:|markdown content:|# x\\.|x\\. it.?s what.?s happening)/i.test(line))
    .filter((line) => !/(phone, email, or username|forgot password|don.?t have an account)/i.test(line))
    .filter((line) => !/(create account|terms of service|privacy policy|cookie use|by signing up|sign up|log in)/i.test(line))
    .filter((line) => !/(already have an account|sign in|get grok|happening\s*\/\s*x)/i.test(line))
    .filter((line) => !/^published time:/i.test(line))
    .filter((line) => !/\[[^\]]+\]\(http/i.test(line))
    .filter((line) => !/^#/.test(line))
    .filter((line) => !line.startsWith('http'))
    .slice(0, maxItems);
}

function compactText(value, maxLength = 260) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 3)}...`;
}

function summarizeFeed(feed) {
  return {
    status: feed.status,
    mode: feed.mode,
    fetchedAt: feed.fetchedAt,
    latencyMs: feed.latencyMs,
    itemCount: feed.itemCount,
    error: feed.error ?? null
  };
}

async function pullFromXViaApi(query, limit, timeoutMs) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error('X_BEARER_TOKEN is not set.');
  }

  const requestUrl = new URL('https://api.twitter.com/2/tweets/search/recent');
  requestUrl.searchParams.set('query', query);
  requestUrl.searchParams.set('max_results', String(limit));
  requestUrl.searchParams.set('tweet.fields', 'created_at,lang,public_metrics,author_id');

  const startedAt = Date.now();
  const response = await fetchWithTimeout(requestUrl.toString(), {
    headers: {
      authorization: `Bearer ${token}`
    }
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`X API returned ${response.status}.`);
  }

  const payload = await response.json();
  const items = (payload.data || [])
    .map((tweet) => compactText(tweet.text))
    .filter(Boolean);

  return {
    status: items.length > 0 ? 'ok' : 'degraded',
    mode: 'api',
    fetchedAt: toIsoNow(),
    latencyMs: Date.now() - startedAt,
    itemCount: items.length,
    items
  };
}

async function pullFromXViaScrape(query, limit, timeoutMs) {
  const requestUrl = `https://r.jina.ai/http://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
  const startedAt = Date.now();
  const response = await fetchWithTimeout(requestUrl, {
    headers: {
      'user-agent': 'qmVP/0.2 (live-market-vector)',
      accept: 'text/plain,text/html'
    }
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`X fallback scrape returned ${response.status}.`);
  }

  const text = await response.text();
  const items = extractFeedLines(text, limit).map((line) => compactText(line));

  return {
    status: items.length > 0 ? 'ok' : 'degraded',
    mode: 'scrape-fallback',
    fetchedAt: toIsoNow(),
    latencyMs: Date.now() - startedAt,
    itemCount: items.length,
    items,
    error: items.length > 0 ? null : 'No parseable posts from fallback scrape.'
  };
}

async function pullXFeed(options) {
  const query = String(options.query || DEFAULT_QUERY).trim() || DEFAULT_QUERY;
  const limit = clampInt(options.xLimit, 1, 20, 8);
  const timeoutMs = clampInt(options.timeoutMs, 2000, 45000, 12000);

  try {
    return await pullFromXViaApi(query, limit, timeoutMs);
  } catch (apiError) {
    try {
      const scraped = await pullFromXViaScrape(query, limit, timeoutMs);
      if (scraped.status !== 'ok') {
        scraped.error = `Sparse scrape response. API fallback reason: ${apiError.message}`;
      }
      return scraped;
    } catch (scrapeError) {
      return {
        status: 'error',
        mode: 'unavailable',
        fetchedAt: toIsoNow(),
        latencyMs: 0,
        itemCount: 0,
        items: [],
        error: `${scrapeError.message} API fallback reason: ${apiError.message}`
      };
    }
  }
}

async function pullRedditFeed(options) {
  const subreddit = normalizeToken(options.subreddit, DEFAULT_SUBREDDIT).toLowerCase();
  const limit = clampInt(options.redditLimit, 1, 25, 8);
  const timeoutMs = clampInt(options.timeoutMs, 2000, 45000, 12000);
  const requestUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?raw_json=1&limit=${limit}`;
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(requestUrl, {
      headers: {
        'user-agent': 'qmVP/0.2 (live-market-vector)'
      }
    }, timeoutMs);

    if (!response.ok) {
      throw new Error(`Reddit returned ${response.status}.`);
    }

    const payload = await response.json();
    const items = (payload?.data?.children || [])
      .map((entry) => {
        const data = entry.data || {};
        const title = compactText(data.title, 180);
        const body = compactText(data.selftext, 180);
        const stats = `score ${toSafeNumber(data.score, 0)} comments ${toSafeNumber(data.num_comments, 0)}`;
        return compactText(`${title}${body ? ` ${body}` : ''} ${stats}`.trim(), 280);
      })
      .filter(Boolean);

    return {
      status: items.length > 0 ? 'ok' : 'degraded',
      mode: 'json',
      fetchedAt: toIsoNow(),
      latencyMs: Date.now() - startedAt,
      itemCount: items.length,
      subreddit,
      items
    };
  } catch (error) {
    return {
      status: 'error',
      mode: 'unavailable',
      fetchedAt: toIsoNow(),
      latencyMs: Date.now() - startedAt,
      itemCount: 0,
      subreddit,
      items: [],
      error: error.message
    };
  }
}

function classifyMarketRegime(quotes) {
  const tradable = quotes.filter((quote) => quote.symbol !== '^VIX');
  const advancers = tradable.filter((quote) => quote.changePercent > 0).length;
  const decliners = tradable.filter((quote) => quote.changePercent < 0).length;
  const breadth = advancers - decliners;
  const vixQuote = quotes.find((quote) => quote.symbol === '^VIX');
  const vix = vixQuote ? vixQuote.price : null;

  let regime = 'mixed';
  if (typeof vix === 'number' && vix >= 25) {
    regime = 'risk-off';
  } else if (breadth > 0 && (typeof vix !== 'number' || vix < 20)) {
    regime = 'risk-on';
  } else if (breadth < 0) {
    regime = 'risk-off';
  }

  return {
    regime,
    breadth,
    advancers,
    decliners,
    vix
  };
}

function toStooqSymbol(symbol) {
  const normalized = String(symbol || '').toUpperCase().trim();
  if (!normalized) {
    return null;
  }

  if (normalized === '^VIX') {
    return null;
  }

  if (normalized.endsWith('.US')) {
    return normalized.toLowerCase();
  }

  if (/^[A-Z0-9]{1,10}$/.test(normalized)) {
    return `${normalized.toLowerCase()}.us`;
  }

  return null;
}

function parseStooqLine(line) {
  const values = String(line || '').trim().split(',');
  if (values.length < 8) {
    return null;
  }

  const symbolRaw = values[0];
  const open = toSafeNumber(values[3], Number.NaN);
  const close = toSafeNumber(values[6], Number.NaN);

  if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) {
    return null;
  }

  const change = close - open;
  const changePercent = (change / open) * 100;

  return {
    symbol: symbolRaw.replace('.US', '').toUpperCase(),
    price: close,
    change,
    changePercent,
    marketState: 'DELAYED'
  };
}

async function pullVixFromCboe(timeoutMs) {
  const response = await fetchWithTimeout('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', {
    headers: {
      'user-agent': 'qmVP/0.2 (live-market-vector)',
      accept: 'text/csv'
    }
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`CBOE VIX endpoint returned ${response.status}.`);
  }

  const csv = await response.text();
  const lines = csv
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CBOE VIX response had no rows.');
  }

  const latest = lines[lines.length - 1].split(',');
  if (latest.length < 5) {
    throw new Error('CBOE VIX row format was invalid.');
  }

  const open = toSafeNumber(latest[1], Number.NaN);
  const close = toSafeNumber(latest[4], Number.NaN);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) {
    throw new Error('CBOE VIX values were invalid.');
  }

  const change = close - open;
  return {
    symbol: '^VIX',
    price: close,
    change,
    changePercent: (change / open) * 100,
    marketState: 'DAILY_CLOSE'
  };
}

async function pullMarketFeedViaStooq(symbols, timeoutMs, previousError) {
  const normalizedSymbols = [...new Set(symbols)];
  const requests = normalizedSymbols.map(async (symbol) => {
    if (symbol === '^VIX') {
      return null;
    }

    const stooqSymbol = toStooqSymbol(symbol);
    if (!stooqSymbol) {
      return null;
    }

    const response = await fetchWithTimeout(`https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`, {
      headers: {
        'user-agent': 'qmVP/0.2 (live-market-vector)',
        accept: 'text/plain'
      }
    }, timeoutMs);

    if (!response.ok) {
      throw new Error(`Stooq returned ${response.status} for ${symbol}.`);
    }

    const body = await response.text();
    return parseStooqLine(body);
  });

  const settled = await Promise.allSettled(requests);
  const quotes = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter(Boolean);

  let vixError = null;
  if (normalizedSymbols.includes('^VIX')) {
    try {
      const vix = await pullVixFromCboe(timeoutMs);
      quotes.push(vix);
    } catch (error) {
      vixError = error.message;
    }
  }

  const lines = quotes.map((quote) => {
    const direction = quote.changePercent >= 0 ? '+' : '';
    return `${quote.symbol} ${direction}${quote.changePercent.toFixed(2)}% @ ${quote.price.toFixed(2)} (${quote.marketState})`;
  });

  const errors = settled
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Unknown stooq quote error.');

  if (vixError) {
    errors.push(vixError);
  }

  return {
    status: quotes.length > 0 ? 'degraded' : 'error',
    mode: 'stooq-fallback',
    fetchedAt: toIsoNow(),
    latencyMs: 0,
    itemCount: quotes.length,
    symbols: normalizedSymbols,
    quotes,
    lines,
    marketStatus: classifyMarketRegime(quotes),
    error: quotes.length > 0
      ? `Primary quote API unavailable: ${previousError?.message || String(previousError)}`
      : [previousError?.message || String(previousError), ...errors].join(' | ')
  };
}

async function pullMarketFeed(options) {
  const symbols = normalizeSymbols(options.symbols);
  const timeoutMs = clampInt(options.timeoutMs, 2000, 45000, 12000);
  const requestUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(requestUrl, {
      headers: {
        'user-agent': 'qmVP/0.2 (live-market-vector)',
        accept: 'application/json'
      }
    }, timeoutMs);

    if (!response.ok) {
      throw new Error(`Market endpoint returned ${response.status}.`);
    }

    const payload = await response.json();
    const results = payload?.quoteResponse?.result || [];
    const quotes = results.map((quote) => ({
      symbol: String(quote.symbol || '').toUpperCase(),
      price: toSafeNumber(quote.regularMarketPrice, 0),
      change: toSafeNumber(quote.regularMarketChange, 0),
      changePercent: toSafeNumber(quote.regularMarketChangePercent, 0),
      marketState: String(quote.marketState || 'UNKNOWN')
    }));

    const lines = quotes.map((quote) => {
      const direction = quote.changePercent >= 0 ? '+' : '';
      return `${quote.symbol} ${direction}${quote.changePercent.toFixed(2)}% @ ${quote.price.toFixed(2)} (${quote.marketState})`;
    });

    return {
      status: quotes.length > 0 ? 'ok' : 'degraded',
      mode: 'quote-api',
      fetchedAt: toIsoNow(),
      latencyMs: Date.now() - startedAt,
      itemCount: quotes.length,
      symbols,
      quotes,
      lines,
      marketStatus: classifyMarketRegime(quotes)
    };
  } catch (error) {
    const fallback = await pullMarketFeedViaStooq(symbols, timeoutMs, error);
    fallback.latencyMs = Date.now() - startedAt;
    return fallback;
  }
}

function asTextBlock(label, lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return '';
  }

  return `${label}: ${lines.join(' ')}`;
}

export async function pullLiveMarketSources(config = {}) {
  const [xFeed, redditFeed, marketFeed] = await Promise.all([
    pullXFeed(config),
    pullRedditFeed(config),
    pullMarketFeed(config)
  ]);

  const synthesizedMarketLines = marketFeed.lines.length > 0
    ? marketFeed.lines
    : [
        `Market feed unavailable status ${marketFeed.status}.`,
        marketFeed.error ? compactText(marketFeed.error, 180) : ''
      ].filter(Boolean);

  const textBlocks = [
    asTextBlock('x sentiment', xFeed.items),
    asTextBlock('reddit sentiment', redditFeed.items),
    asTextBlock('market tape', synthesizedMarketLines)
  ].filter(Boolean);

  const combinedRaw = textBlocks.join(' ');
  const combinedText = htmlToText(combinedRaw);

  return {
    fetchedAt: toIsoNow(),
    combinedText,
    feeds: {
      x: summarizeFeed(xFeed),
      reddit: summarizeFeed(redditFeed),
      market: summarizeFeed(marketFeed)
    },
    marketStatus: marketFeed.marketStatus,
    marketQuotes: marketFeed.quotes,
    snippets: {
      x: xFeed.items.slice(0, 6),
      reddit: redditFeed.items.slice(0, 6),
      market: marketFeed.lines.slice(0, 8)
    }
  };
}
