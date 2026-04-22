const controlForm = document.querySelector('#control-form');
const queryInput = document.querySelector('#query-input');
const subredditInput = document.querySelector('#subreddit-input');
const symbolsInput = document.querySelector('#symbols-input');
const intervalSelect = document.querySelector('#interval-select');
const pullNowButton = document.querySelector('#pull-now-btn');
const autoToggleButton = document.querySelector('#auto-toggle-btn');

const clockTime = document.querySelector('#clock-time');
const clockDate = document.querySelector('#clock-date');
const autoStatePill = document.querySelector('#auto-state');
const lastRunPill = document.querySelector('#last-run-pill');
const nextRunPill = document.querySelector('#next-run-pill');

const decisionConfidence = document.querySelector('#decision-confidence');
const decisionCallout = document.querySelector('#decision-callout');
const buyProb = document.querySelector('#buy-prob');
const sellProb = document.querySelector('#sell-prob');
const holdProb = document.querySelector('#hold-prob');

const vectorBlock = document.querySelector('#vector-block');
const explanationBlock = document.querySelector('#explanation-block');
const logBlock = document.querySelector('#log-block');

const feedStatusList = document.querySelector('#feed-status-list');
const regimePill = document.querySelector('#regime-pill');
const advancersVal = document.querySelector('#advancers-val');
const declinersVal = document.querySelector('#decliners-val');
const breadthVal = document.querySelector('#breadth-val');
const vixVal = document.querySelector('#vix-val');

const tickerList = document.querySelector('#ticker-list');
const xSnippetList = document.querySelector('#x-snippet-list');
const redditSnippetList = document.querySelector('#reddit-snippet-list');
const confidenceCanvas = document.querySelector('#confidence-canvas');

const state = {
  autoTimerId: null,
  intervalMs: Number(intervalSelect.value || 10000),
  inFlight: false,
  lastRunAt: null,
  nextRunAt: null,
  confidenceTrail: []
};

function nowClock() {
  const now = new Date();

  clockTime.textContent = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  clockDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
}

function logLine(message, level = 'info') {
  const tag = new Date().toISOString().slice(11, 19);
  const prefix = level.toUpperCase().padEnd(5, ' ');
  logBlock.textContent = `[${tag}] ${prefix} ${message}\n${logBlock.textContent}`.slice(0, 14000);
}

function parseSymbols(rawSymbols) {
  return String(rawSymbols || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readLiveConfigFromInputs() {
  return {
    query: queryInput.value.trim(),
    subreddit: subredditInput.value.trim(),
    symbols: parseSymbols(symbolsInput.value),
    xLimit: 8,
    redditLimit: 8,
    timeoutMs: 12000
  };
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function renderJson(target, value) {
  target.textContent = JSON.stringify(value, null, 2);
}

function renderDecision(payload) {
  const decision = payload.decision || {};
  const probabilities = decision.probabilities || {};

  buyProb.textContent = formatPercent(probabilities.buy);
  sellProb.textContent = formatPercent(probabilities.sell);
  holdProb.textContent = formatPercent(probabilities.hold);

  decisionConfidence.textContent = `confidence ${Number(decision.confidence || 0).toFixed(4)}`;

  const label = String(decision.label || 'hold').toUpperCase();
  decisionCallout.textContent = `${label} VECTOR | token density ${payload?.source?.tokenCount ?? 0}`;

  decisionCallout.style.borderColor =
    label === 'BUY' ? 'rgba(76, 255, 172, 0.62)'
      : label === 'SELL' ? 'rgba(255, 95, 116, 0.62)'
        : 'rgba(255, 217, 77, 0.62)';

  decisionCallout.style.color =
    label === 'BUY' ? '#4cffac'
      : label === 'SELL' ? '#ff5f74'
        : '#ffd94d';
}

function renderFeedStatuses(feeds) {
  const rows = [
    ['x', 'X'],
    ['reddit', 'Reddit'],
    ['market', 'Market']
  ];

  feedStatusList.innerHTML = '';

  for (const [key, label] of rows) {
    const feed = feeds?.[key] || {};
    const status = String(feed.status || 'unknown').toLowerCase();
    const latency = Number.isFinite(Number(feed.latencyMs)) ? `${feed.latencyMs}ms` : '--';
    const count = Number.isFinite(Number(feed.itemCount)) ? feed.itemCount : '--';

    const li = document.createElement('li');
    const left = document.createElement('span');
    const right = document.createElement('strong');

    left.textContent = label;
    right.className = status;
    right.textContent = `${status} | items ${count} | ${latency}`;

    li.title = feed.error || '';
    li.append(left, right);
    feedStatusList.append(li);
  }
}

function renderMarketStatus(marketStatus) {
  const regime = String(marketStatus?.regime || 'unknown').toLowerCase();
  regimePill.className = `regime ${regime}`;
  regimePill.textContent = regime.toUpperCase();

  advancersVal.textContent = Number.isFinite(marketStatus?.advancers) ? String(marketStatus.advancers) : '--';
  declinersVal.textContent = Number.isFinite(marketStatus?.decliners) ? String(marketStatus.decliners) : '--';
  breadthVal.textContent = Number.isFinite(marketStatus?.breadth) ? String(marketStatus.breadth) : '--';
  vixVal.textContent = Number.isFinite(marketStatus?.vix) ? marketStatus.vix.toFixed(2) : '--';
}

function renderTickerQuotes(quotes) {
  tickerList.innerHTML = '';

  if (!Array.isArray(quotes) || quotes.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No market quotes available.';
    tickerList.append(li);
    return;
  }

  for (const quote of quotes.slice(0, 10)) {
    const li = document.createElement('li');
    const symbol = document.createElement('span');
    const movement = document.createElement('strong');

    symbol.textContent = `${quote.symbol} ${Number.isFinite(quote.price) ? quote.price.toFixed(2) : '--'}`;

    const changePct = Number(quote.changePercent || 0);
    movement.textContent = formatSignedPercent(changePct);

    movement.className = changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat';

    li.append(symbol, movement);
    tickerList.append(li);
  }
}

function renderSnippets(target, snippets, fallbackMessage) {
  target.innerHTML = '';

  if (!Array.isArray(snippets) || snippets.length === 0) {
    const li = document.createElement('li');
    li.textContent = fallbackMessage;
    target.append(li);
    return;
  }

  for (const snippet of snippets.slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = String(snippet);
    target.append(li);
  }
}

function addConfidencePoint(probabilities) {
  state.confidenceTrail.push({
    buy: Number(probabilities.buy || 0),
    sell: Number(probabilities.sell || 0),
    hold: Number(probabilities.hold || 0),
    ts: Date.now()
  });

  if (state.confidenceTrail.length > 80) {
    state.confidenceTrail.shift();
  }
}

function drawConfidenceTrail() {
  const context = confidenceCanvas.getContext('2d');
  if (!context) {
    return;
  }

  const width = confidenceCanvas.width;
  const height = confidenceCanvas.height;
  const padding = 10;

  context.clearRect(0, 0, width, height);

  context.strokeStyle = 'rgba(97, 195, 255, 0.3)';
  context.lineWidth = 1;
  context.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + ((height - (padding * 2)) * i) / 4;
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
  }
  context.stroke();

  if (state.confidenceTrail.length < 2) {
    return;
  }

  const drawSeries = (key, color) => {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = 1.6;

    state.confidenceTrail.forEach((point, index) => {
      const x = padding + ((width - (padding * 2)) * index) / (state.confidenceTrail.length - 1);
      const value = Math.min(1, Math.max(0, Number(point[key] || 0)));
      const y = height - padding - ((height - (padding * 2)) * value);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  };

  drawSeries('buy', 'rgba(76, 255, 172, 0.95)');
  drawSeries('sell', 'rgba(255, 95, 116, 0.95)');
  drawSeries('hold', 'rgba(255, 217, 77, 0.95)');
}

function toShortTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return '--';
  }

  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function updateRunPills() {
  lastRunPill.textContent = `LAST: ${toShortTime(state.lastRunAt)}`;

  if (!state.autoTimerId) {
    nextRunPill.textContent = 'NEXT: --';
    return;
  }

  const msRemaining = Math.max(0, Number(state.nextRunAt || 0) - Date.now());
  const secRemaining = (msRemaining / 1000).toFixed(msRemaining < 10000 ? 1 : 0);
  nextRunPill.textContent = `NEXT: ${secRemaining}s`;
}

function applyAutoState(isEnabled) {
  autoStatePill.textContent = isEnabled ? 'AUTO ON' : 'AUTO OFF';
  autoStatePill.className = `pill ${isEnabled ? 'on' : 'off'}`;
  autoToggleButton.textContent = isEnabled ? 'STOP AUTO' : 'START AUTO';
}

async function executeLivePull(triggerReason = 'manual') {
  if (state.inFlight) {
    logLine(`pull skipped (${triggerReason}), previous run still in-flight`, 'warn');
    return;
  }

  state.inFlight = true;
  pullNowButton.disabled = true;
  autoToggleButton.disabled = true;

  try {
    const config = readLiveConfigFromInputs();
    const symbolList = config.symbols.join(',') || '-';

    logLine(`pull start [${triggerReason}] x="${config.query}" r/${config.subreddit || '-'} symbols=${symbolList}`);

    const response = await fetch('/api/pull/live', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Live pull failed.');
    }

    state.lastRunAt = Date.now();
    if (state.autoTimerId) {
      state.nextRunAt = Date.now() + state.intervalMs;
    }

    renderDecision(payload);
    renderJson(vectorBlock, payload.vector || {});
    renderJson(explanationBlock, payload.explanation || []);
    renderFeedStatuses(payload.source?.feeds || {});
    renderMarketStatus(payload.marketStatus || {});
    renderTickerQuotes(payload.marketQuotes || []);
    renderSnippets(xSnippetList, payload.snippets?.x || [], 'X feed unavailable.');
    renderSnippets(redditSnippetList, payload.snippets?.reddit || [], 'Reddit feed unavailable.');

    addConfidencePoint(payload.decision?.probabilities || {});
    drawConfidenceTrail();

    logLine(`pull complete decision=${payload.decision?.label || 'hold'} confidence=${payload.decision?.confidence ?? 0}`);
  } catch (error) {
    const message = error?.message || 'Unknown pull error.';
    decisionCallout.textContent = `ERROR | ${message}`;
    decisionCallout.style.borderColor = 'rgba(255, 95, 116, 0.62)';
    decisionCallout.style.color = '#ff5f74';
    logLine(`pull error ${message}`, 'error');
  } finally {
    state.inFlight = false;
    pullNowButton.disabled = false;
    autoToggleButton.disabled = false;
    updateRunPills();
  }
}

function stopAuto() {
  if (state.autoTimerId) {
    clearInterval(state.autoTimerId);
    state.autoTimerId = null;
  }
  state.nextRunAt = null;
  applyAutoState(false);
  updateRunPills();
  logLine('auto refresh stopped');
}

function restartAutoTicker() {
  if (!state.autoTimerId) {
    return;
  }

  clearInterval(state.autoTimerId);

  state.autoTimerId = setInterval(() => {
    state.nextRunAt = Date.now() + state.intervalMs;
    updateRunPills();
    void executeLivePull('auto');
  }, state.intervalMs);

  state.nextRunAt = Date.now() + state.intervalMs;
  updateRunPills();
}

function startAuto() {
  if (state.autoTimerId) {
    return;
  }

  state.intervalMs = Number(intervalSelect.value || 10000);
  state.nextRunAt = Date.now() + state.intervalMs;

  state.autoTimerId = setInterval(() => {
    state.nextRunAt = Date.now() + state.intervalMs;
    updateRunPills();
    void executeLivePull('auto');
  }, state.intervalMs);

  applyAutoState(true);
  updateRunPills();
  logLine(`auto refresh started interval=${state.intervalMs}ms`);
  void executeLivePull('auto-start');
}

controlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void executeLivePull('manual');
});

autoToggleButton.addEventListener('click', () => {
  if (state.autoTimerId) {
    stopAuto();
  } else {
    startAuto();
  }
});

intervalSelect.addEventListener('change', () => {
  state.intervalMs = Number(intervalSelect.value || 10000);
  logLine(`interval set to ${state.intervalMs}ms`);
  restartAutoTicker();
});

window.addEventListener('beforeunload', () => {
  if (state.autoTimerId) {
    clearInterval(state.autoTimerId);
  }
});

nowClock();
setInterval(nowClock, 1000);
setInterval(updateRunPills, 250);

applyAutoState(false);
updateRunPills();
logLine('qmVP live vector deck ready');
void executeLivePull('boot');
