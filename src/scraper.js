import { htmlToText, decodeEntities } from './text.js';
import { toSafeNumber } from './utils.js';

function extractTagContent(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(pattern);
  return match ? decodeEntities(match[1]).trim() : '';
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(match[1]).trim() : '';
}

function assertHttpUrl(rawUrl) {
  let candidate;

  try {
    candidate = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL. Provide a full http(s) URL.');
  }

  if (!['http:', 'https:'].includes(candidate.protocol)) {
    throw new Error('Only http(s) URLs are supported.');
  }

  return candidate.toString();
}

export async function scrapeMarketPage(rawUrl, timeoutMs = 12000) {
  const normalizedUrl = assertHttpUrl(rawUrl);
  const timeout = toSafeNumber(timeoutMs, 12000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        'user-agent': 'qmVP/0.1 (market-vector-puller)',
        accept: 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Fetch timed out while scraping URL.');
    }

    throw new Error(`Failed to fetch URL: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Scrape request failed (${response.status}).`);
  }

  const html = await response.text();
  const text = htmlToText(html);

  return {
    url: normalizedUrl,
    status: response.status,
    fetchedAt: new Date().toISOString(),
    title: extractTagContent(html, 'title'),
    description: extractMetaDescription(html),
    text,
    html
  };
}
