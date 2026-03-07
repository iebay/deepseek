import https from 'https';
import http from 'http';
import { URL } from 'url';

const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RESULTS = 5;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function httpsGet(urlStr: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      urlStr,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DeepSeekAgent/1.0)',
          Accept: 'text/html,application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(res.headers.location, redirectsLeft - 1).then(resolve).catch(reject);
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.on('error', reject);
  });
}

async function searchWithApi(
  query: string,
  maxResults: number,
  apiKey: string,
  endpoint: string,
): Promise<SearchResult[]> {
  const url = new URL(endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; DeepSeekAgent/1.0)',
  };

  // Determine auth header style based on endpoint (Bing vs Google)
  if (url.hostname === 'customsearch.googleapis.com' || url.hostname.endsWith('.googleapis.com')) {
    url.searchParams.set('key', apiKey);
    url.searchParams.set('num', String(maxResults));
  } else {
    headers['Ocp-Apim-Subscription-Key'] = apiKey;
  }

  const raw = await httpsGet(url.toString());
  const data = JSON.parse(raw) as Record<string, unknown>;

  // Bing format
  const webPages = data.webPages as { value?: Array<{ name: string; url: string; snippet: string }> } | undefined;
  if (webPages?.value) {
    return webPages.value.slice(0, maxResults).map(item => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
    }));
  }

  // Google Custom Search format
  const items = data.items as Array<{ title: string; link: string; snippet: string }> | undefined;
  if (items) {
    return items.slice(0, maxResults).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  }

  return [];
}

function parseDuckDuckGoHtml(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  // DuckDuckGo HTML result blocks pattern
  const resultPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetPattern = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const titleMatches = [...html.matchAll(resultPattern)];
  const snippetMatches = [...html.matchAll(snippetPattern)];

  // Strip HTML tags and any residual angle brackets for safety
  function stripHtml(s: string): string {
    // Remove all content between angle brackets, then remove any stray angle brackets
    let result = s;
    // Iteratively strip tags to handle nested/malformed markup
    let prev = '';
    while (prev !== result) {
      prev = result;
      result = result.replace(/<[^<>]*>/g, '');
    }
    return result.replace(/[<>]/g, '').trim();
  }

  for (let i = 0; i < Math.min(titleMatches.length, maxResults); i++) {
    const urlRaw = titleMatches[i][1];
    const titleRaw = stripHtml(titleMatches[i][2]);
    const snippetRaw = snippetMatches[i] ? stripHtml(snippetMatches[i][1]) : '';

    // DuckDuckGo often uses redirect URLs like //duckduckgo.com/l/?uddg=...
    let url = urlRaw;
    if (url.startsWith('//')) url = 'https:' + url;
    try {
      const parsed = new URL(url);
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
    } catch {
      // keep original url
    }

    if (titleRaw && url) {
      results.push({ title: titleRaw, url, snippet: snippetRaw });
    }
  }
  return results;
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await httpsGet(url);
  return parseDuckDuckGoHtml(html, maxResults);
}

export async function search(
  query: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
): Promise<SearchResult[]> {
  const apiKey = process.env.SEARCH_API_KEY;
  const endpoint = process.env.SEARCH_API_ENDPOINT;

  if (apiKey && endpoint) {
    return searchWithApi(query, maxResults, apiKey, endpoint);
  }

  return searchDuckDuckGo(query, maxResults);
}
