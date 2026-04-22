import { FEATURE_KEYS, MODEL_LABELS } from './lexicon.js';
import { clamp, sigmoid, softmax } from './utils.js';

function dotProduct(weights, features) {
  let sum = weights.bias ?? 0;
  for (const key of FEATURE_KEYS) {
    sum += (weights[key] ?? 0) * (features[key] ?? 0);
  }

  return sum;
}

function normalizeProbabilities(probabilities) {
  return {
    buy: clamp(probabilities.buy ?? 0, 0, 1),
    sell: clamp(probabilities.sell ?? 0, 0, 1),
    hold: clamp(probabilities.hold ?? 0, 0, 1)
  };
}

export class QuantativeVectorModel {
  constructor(state) {
    this.state = state;
  }

  score(features) {
    const scores = {};
    for (const label of MODEL_LABELS) {
      scores[label] = dotProduct(this.state.weights[label], features);
    }

    return scores;
  }

  predict(features) {
    const scores = this.score(features);
    const probabilities = normalizeProbabilities(softmax(scores));

    const decision = Object.entries(probabilities)
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      decision,
      scores,
      probabilities
    };
  }

  explain(features, decision, topN = 5) {
    const weights = this.state.weights[decision];
    const contributions = FEATURE_KEYS.map((key) => ({
      feature: key,
      value: features[key] ?? 0,
      weight: weights[key] ?? 0,
      contribution: (weights[key] ?? 0) * (features[key] ?? 0)
    }));

    return contributions
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, topN);
  }

  train(features, label) {
    if (!MODEL_LABELS.includes(label)) {
      throw new Error('Training label must be one of buy/sell/hold.');
    }

    const lr = this.state.learningRate;

    for (const classLabel of MODEL_LABELS) {
      const target = classLabel === label ? 1 : 0;
      const score = dotProduct(this.state.weights[classLabel], features);
      const prediction = sigmoid(score);
      const error = prediction - target;

      for (const key of FEATURE_KEYS) {
        this.state.weights[classLabel][key] -= lr * error * (features[key] ?? 0);
      }

      this.state.weights[classLabel].bias -= lr * error;
    }

    this.state.trainedSamples += 1;
    this.state.updatedAt = new Date().toISOString();
    return this.state;
  }
}
