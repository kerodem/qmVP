const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' '
};

export function htmlToText(html) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');

  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutTags)
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeEntities(text) {
  let output = text;
  for (const [entity, value] of Object.entries(ENTITY_MAP)) {
    output = output.split(entity).join(value);
  }

  return output;
}

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function topSentences(text, maxSentences = 3) {
  const fragments = text
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 35)
    .slice(0, 20);

  return fragments.slice(0, maxSentences);
}
