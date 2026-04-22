const form = document.querySelector('#pull-form');
const urlInput = document.querySelector('#url-input');
const decisionBlock = document.querySelector('#decision-block');
const vectorBlock = document.querySelector('#vector-block');
const explanationBlock = document.querySelector('#explanation-block');
const logBlock = document.querySelector('#log-block');
const trainSelect = document.querySelector('#train-label');
const trainButton = document.querySelector('#train-button');

let lastPulledUrl = '';

function nowTag() {
  return new Date().toISOString().slice(11, 19);
}

function log(line) {
  logBlock.textContent = `[${nowTag()}] ${line}\n${logBlock.textContent}`.slice(0, 8000);
}

function renderDecision(result) {
  const { label, confidence, probabilities } = result.decision;
  const buy = probabilities.buy ?? 0;
  const sell = probabilities.sell ?? 0;
  const hold = probabilities.hold ?? 0;

  decisionBlock.textContent = [
    `label      : ${label.toUpperCase()}`,
    `confidence : ${confidence}`,
    '',
    `buy  -> ${(buy * 100).toFixed(2)}%`,
    `sell -> ${(sell * 100).toFixed(2)}%`,
    `hold -> ${(hold * 100).toFixed(2)}%`,
    '',
    `source     : ${result.source.title || 'untitled page'}`,
    `tokens     : ${result.source.tokenCount}`,
    `fetchedAt  : ${result.source.fetchedAt}`
  ].join('\n');
}

function renderJson(el, obj) {
  el.textContent = JSON.stringify(obj, null, 2);
}

async function executePull(url) {
  log(`pull start -> ${url}`);

  const response = await fetch(`/api/pull?url=${encodeURIComponent(url)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Pull request failed');
  }

  renderDecision(payload);
  renderJson(vectorBlock, payload.vector);
  renderJson(explanationBlock, payload.explanation);
  log(`pull complete -> decision=${payload.decision.label} confidence=${payload.decision.confidence}`);
  return payload;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = urlInput.value.trim();

  if (!url) {
    return;
  }

  try {
    const result = await executePull(url);
    lastPulledUrl = result.source.url;
  } catch (error) {
    log(`pull error -> ${error.message}`);
    decisionBlock.textContent = `error:\n${error.message}`;
  }
});

trainButton.addEventListener('click', async () => {
  const url = lastPulledUrl || urlInput.value.trim();
  const label = trainSelect.value;

  if (!url) {
    log('train aborted -> no URL available');
    return;
  }

  try {
    log(`train start -> ${label} @ ${url}`);
    const response = await fetch('/api/train', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ url, label })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Training failed');
    }

    log(`train complete -> samples=${payload.trainedSamples}`);
    await executePull(url);
  } catch (error) {
    log(`train error -> ${error.message}`);
  }
});

log('qmVP terminal ready');
