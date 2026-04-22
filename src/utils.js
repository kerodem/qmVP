export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

export function softmax(scores) {
  const entries = Object.entries(scores);
  const maxValue = Math.max(...entries.map(([, value]) => value));

  let sum = 0;
  const exponentials = {};

  for (const [key, value] of entries) {
    const expValue = Math.exp(value - maxValue);
    exponentials[key] = expValue;
    sum += expValue;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(exponentials)) {
    normalized[key] = sum === 0 ? 0 : value / sum;
  }

  return normalized;
}

export function utcTimestamp() {
  return new Date().toISOString();
}

export function toSafeNumber(value, fallback = 0) {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}
