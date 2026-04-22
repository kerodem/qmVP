import { scrapeMarketPage } from './scraper.js';
import { buildFeatureVector } from './features.js';
import { loadModelState, persistModelState } from './model-state.js';
import { QuantativeVectorModel } from './model.js';
import { pullLiveMarketSources } from './live-feeds.js';

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function normalizeForOutput(object) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, round4(value)])
  );
}

export class QuantativeMarketVectorPullEngine {
  constructor(modelStatePath) {
    this.modelStatePath = modelStatePath;
    this.model = null;
  }

  async ensureModel() {
    if (this.model) {
      return this.model;
    }

    const state = await loadModelState(this.modelStatePath);
    this.model = new QuantativeVectorModel(state);
    return this.model;
  }

  async pull(rawUrl) {
    const model = await this.ensureModel();
    const scraped = await scrapeMarketPage(rawUrl);
    const { vector, tokenCount, previewSentences } = buildFeatureVector(scraped.text);
    const prediction = model.predict(vector);
    const explanation = model.explain(vector, prediction.decision, 6);

    return {
      source: {
        url: scraped.url,
        title: scraped.title,
        description: scraped.description,
        fetchedAt: scraped.fetchedAt,
        tokenCount
      },
      vector: normalizeForOutput(vector),
      decision: {
        label: prediction.decision,
        probabilities: normalizeForOutput(prediction.probabilities),
        confidence: round4(prediction.probabilities[prediction.decision])
      },
      explanation: explanation.map((item) => ({
        feature: item.feature,
        contribution: round4(item.contribution),
        value: round4(item.value),
        weight: round4(item.weight)
      })),
      sample: {
        previewSentences
      }
    };
  }

  async pullLive(config = {}) {
    const model = await this.ensureModel();
    const live = await pullLiveMarketSources(config);
    const { vector, tokenCount, previewSentences } = buildFeatureVector(live.combinedText);
    const prediction = model.predict(vector);
    const explanation = model.explain(vector, prediction.decision, 6);

    return {
      mode: 'live-market-vector',
      source: {
        fetchedAt: live.fetchedAt,
        tokenCount,
        feeds: live.feeds
      },
      marketStatus: live.marketStatus,
      marketQuotes: live.marketQuotes,
      snippets: live.snippets,
      vector: normalizeForOutput(vector),
      decision: {
        label: prediction.decision,
        probabilities: normalizeForOutput(prediction.probabilities),
        confidence: round4(prediction.probabilities[prediction.decision])
      },
      explanation: explanation.map((item) => ({
        feature: item.feature,
        contribution: round4(item.contribution),
        value: round4(item.value),
        weight: round4(item.weight)
      })),
      sample: {
        previewSentences
      }
    };
  }

  async train(rawUrl, label) {
    const model = await this.ensureModel();
    const scraped = await scrapeMarketPage(rawUrl);
    const { vector } = buildFeatureVector(scraped.text);

    model.train(vector, label);
    await persistModelState(this.modelStatePath, model.state);

    const postTrainingPrediction = model.predict(vector);

    return {
      status: 'trained',
      label,
      url: scraped.url,
      trainedSamples: model.state.trainedSamples,
      updatedAt: model.state.updatedAt,
      postTrainingProbabilities: normalizeForOutput(postTrainingPrediction.probabilities)
    };
  }

  async modelSummary() {
    const model = await this.ensureModel();

    return {
      trainedSamples: model.state.trainedSamples,
      learningRate: model.state.learningRate,
      updatedAt: model.state.updatedAt,
      weights: model.state.weights
    };
  }
}
