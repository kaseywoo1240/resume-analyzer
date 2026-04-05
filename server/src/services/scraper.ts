import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface ScrapedJob {
  jobDescription: string;
  jobTitle: string;
}

/**
 * Scrape a job posting URL and return the job description text and title.
 * Handles Greenhouse API (gh_jid param), LinkedIn, Indeed, Lever, and generic boards.
 */
export async function scrapeJobDescription(url: string): Promise<ScrapedJob> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // ── Greenhouse embed API (gh_jid in query string on any domain) ──────────────
  const ghJid = parsed.searchParams.get('gh_jid');
  if (ghJid) {
    const boardToken = inferGreenhouseBoardToken(hostname);
    const result = await tryGreenhouseApi(boardToken, ghJid);
    if (result) return result;
    // If the API call failed, fall through to HTML scraping
  }

  // ── boards.greenhouse.io direct URL ─────────────────────────────────────────
  if (hostname.includes('boards.greenhouse.io') || hostname.includes('greenhouse.io')) {
    // Try the API path: /v1/boards/{board}/jobs/{id}
    const apiResult = await tryGreenhouseFromUrl(url);
    if (apiResult) return apiResult;
  }

  // ── lever.co ────────────────────────────────────────────────────────────────
  if (hostname.includes('lever.co')) {
    const leverResult = await tryLeverApi(url);
    if (leverResult) return leverResult;
  }

  // ── HTML scraping for everything else ────────────────────────────────────────
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  if (hostname.includes('linkedin.com')) return scrapeLinkedIn($);
  if (hostname.includes('indeed.com')) return scrapeIndeed($);
  if (hostname.includes('greenhouse.io')) return scrapeGreenhouse($);
  if (hostname.includes('lever.co')) return scrapeLever($);

  return scrapeGeneric($, url);
}

// ─── Greenhouse API helpers ───────────────────────────────────────────────────

/**
 * Derive the Greenhouse board token from a company's hostname.
 * e.g. "otter.ai" → "otterai", "stripe.com" → "stripe"
 */
function inferGreenhouseBoardToken(hostname: string): string {
  // Strip www. and common TLDs, collapse dots
  return hostname
    .replace(/^www\./, '')
    .replace(/\.(com|io|ai|co|net|org|app)(\/.*)?$/, '')
    .replace(/\./g, '');
}

async function tryGreenhouseApi(boardToken: string, jobId: string): Promise<ScrapedJob | null> {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    } as Parameters<typeof fetch>[1]);

    if (!res.ok) return null;

    const data = (await res.json()) as { title?: string; content?: string };
    if (!data.title && !data.content) return null;

    const $ = cheerio.load(data.content ?? '');
    const description = cleanJobText($.text());

    return {
      jobTitle: data.title ?? '',
      jobDescription: description,
    };
  } catch {
    return null;
  }
}

async function tryGreenhouseFromUrl(url: string): Promise<ScrapedJob | null> {
  // Match: /boards/{board}/jobs/{id}  or  /v1/boards/{board}/jobs/{id}
  const match = url.match(/boards\/([^/]+)\/jobs\/(\d+)/);
  if (!match) return null;
  return tryGreenhouseApi(match[1], match[2]);
}

// ─── Lever API helper ─────────────────────────────────────────────────────────

async function tryLeverApi(url: string): Promise<ScrapedJob | null> {
  // Lever posting URLs: https://jobs.lever.co/{company}/{uuid}
  const match = url.match(/lever\.co\/([^/]+)\/([0-9a-f-]{36})/);
  if (!match) return null;

  const apiUrl = `https://api.lever.co/v0/postings/${match[1]}/${match[2]}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    } as Parameters<typeof fetch>[1]);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      text?: string;
      descriptionPlain?: string;
      description?: string;
      lists?: { text: string; content: string }[];
      additionalPlain?: string;
    };

    const parts: string[] = [];
    if (data.descriptionPlain) parts.push(data.descriptionPlain);
    if (data.lists) {
      for (const list of data.lists) {
        parts.push(list.text + '\n' + list.content.replace(/<[^>]+>/g, '\n'));
      }
    }
    if (data.additionalPlain) parts.push(data.additionalPlain);

    const description = cleanJobText(parts.join('\n\n'));
    return { jobTitle: data.text ?? '', jobDescription: description };
  } catch {
    return null;
  }
}

// ─── Platform-specific HTML scrapers ─────────────────────────────────────────

function scrapeLinkedIn($: cheerio.CheerioAPI): ScrapedJob {
  $('nav, footer, script, style, header').remove();

  const descSelectors = [
    '.description__text',
    '.show-more-less-html__markup',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '[data-test="description"]',
  ];

  let jobDescription = '';
  for (const sel of descSelectors) {
    const text = $(sel).text().trim();
    if (text.length > 100) { jobDescription = text; break; }
  }

  const titleSelectors = [
    'h1.job-title', 'h1.topcard__title',
    '.jobs-unified-top-card__job-title',
    'h1[data-test="job-title"]', 'h1',
  ];

  let jobTitle = '';
  for (const sel of titleSelectors) {
    const text = $(sel).first().text().trim();
    if (text) { jobTitle = text; break; }
  }

  if (!jobDescription) return scrapeGeneric($);
  return { jobDescription: cleanJobText(jobDescription), jobTitle };
}

function scrapeIndeed($: cheerio.CheerioAPI): ScrapedJob {
  $('nav, footer, script, style, header').remove();

  const jobDescription =
    $('#jobDescriptionText').text().trim() ||
    $('[data-testid="jobsearch-jobDescriptionText"]').text().trim() ||
    scrapeGeneric($).jobDescription;

  const jobTitle =
    $('h1.jobsearch-JobInfoHeader-title').text().trim() ||
    $('[data-testid="jobsearch-JobInfoHeader-title"]').text().trim() ||
    $('h1').first().text().trim();

  return { jobDescription: cleanJobText(jobDescription), jobTitle };
}

function scrapeGreenhouse($: cheerio.CheerioAPI): ScrapedJob {
  $('nav, footer, script, style, header').remove();

  const jobDescription =
    $('#content').text().trim() ||
    $('.job-post').text().trim() ||
    scrapeGeneric($).jobDescription;

  const jobTitle = $('h1.app-title').text().trim() || $('h1').first().text().trim();
  return { jobDescription: cleanJobText(jobDescription), jobTitle };
}

function scrapeLever($: cheerio.CheerioAPI): ScrapedJob {
  $('nav, footer, script, style, header').remove();

  const jobDescription =
    $('.section-wrapper').text().trim() ||
    $('[data-qa="job-description"]').text().trim() ||
    scrapeGeneric($).jobDescription;

  const jobTitle =
    $('h2[data-qa="posting-name"]').text().trim() || $('h1').first().text().trim();

  return { jobDescription: cleanJobText(jobDescription), jobTitle };
}

function scrapeGeneric($: cheerio.CheerioAPI, _url?: string): ScrapedJob {
  $(
    'nav, footer, header, script, style, noscript, iframe, ' +
    '.nav, .navbar, .footer, .header, .sidebar, .menu, .cookie, ' +
    '.advertisement, .ads, .social, .share, .comments'
  ).remove();

  const contentSelectors = [
    'main', 'article',
    '.job-description', '.description', '.posting-description',
    '.job-details', '.job-content',
    '#job-description', '#description',
    '.content', '#main-content',
  ];

  let bestContent = '';
  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().trim();
      if (text.length > bestContent.length) bestContent = text;
    }
  }

  if (bestContent.length < 200) bestContent = $('body').text().trim();

  const jobTitle = $('h1').first().text().trim() || $('title').text().trim();
  return { jobDescription: cleanJobText(bestContent), jobTitle };
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
    timeout: 15000,
  } as Parameters<typeof fetch>[1]);

  if (!response.ok) {
    throw new Error(`Failed to fetch job URL: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function cleanJobText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}
