import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_MODEL_WEIGHTS } from './lexicon.js';

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createInitialState() {
  return {
    weights: deepCopy(DEFAULT_MODEL_WEIGHTS),
    learningRate: 0.045,
    trainedSamples: 0,
    updatedAt: new Date().toISOString()
  };
}

export async function loadModelState(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed.weights) {
      return createInitialState();
    }

    return {
      ...createInitialState(),
      ...parsed,
      weights: {
        ...deepCopy(DEFAULT_MODEL_WEIGHTS),
        ...parsed.weights
      }
    };
  } catch {
    return createInitialState();
  }
}

export async function persistModelState(filePath, state) {
  const parent = path.dirname(filePath);
  await mkdir(parent, { recursive: true });
  await writeFile(filePath, JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString()
  }, null, 2));
}
