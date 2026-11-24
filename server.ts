import 'dotenv/config';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import * as cheerio from 'cheerio';
import type {
  ArticleMetadata,
  ArticlePdfCheckResponse,
  ArticleSearchResponse,
  LookupResponse,
  SciHubRecord,
  SearchArticleResult,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DEFAULT_HEADERS = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
};

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/;

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a === 192 && b === 0 && parts[2] === 2) return true;
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true; // link-local fe80::/10
    }
    if (normalized.startsWith('ff')) return true; // multicast
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }

  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('رابط غير صالح.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('يُسمح فقط بروابط HTTP و HTTPS.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('العنوان المطلوب غير مسموح به.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('الوصول إلى الشبكات الداخلية غير مسموح.');
    }
    return parsed;
  }

  const records = await dns.lookup(host, { all: true });
  if (!records || records.length === 0) {
    throw new Error('تعذّر حل اسم النطاق للرابط.');
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('الوصول إلى الشبكات الداخلية غير مسموح.');
    }
  }

  return parsed;
}

async function safeFetch(
  rawUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
    method?: string;
  } = {}
): Promise<{ response: Response; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = rawUrl;
  let redirects = 0;

  while (true) {
    const safeUrl = await assertSafePublicUrl(currentUrl);
    const response = await fetch(safeUrl.toString(), {
      method: options.method ?? 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers ?? {}),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= maxRedirects) {
        return { response, finalUrl: safeUrl.toString() };
      }
      const nextUrl = new URL(location, safeUrl).toString();
      // Break self-redirect loops (common on some Sci-Hub endpoints for missing articles)
      if (nextUrl === safeUrl.toString()) {
        return { response, finalUrl: safeUrl.toString() };
      }
      currentUrl = nextUrl;
      redirects += 1;
      continue;
    }

    return { response, finalUrl: safeUrl.toString() };
  }
}

async function readTextLimited(response: Response, maxBytes = 2 * 1024 * 1024): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes))));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
}

function cleanDoi(raw: string): string | null {
  let candidate = decodeURIComponent(raw.trim());
  candidate = candidate.replace(/^doi:\s*/i, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  const match = candidate.match(DOI_PATTERN);
  if (!match) return null;

  let doi = match[0];
  // Strip trailing punctuation and common publisher view suffixes
  doi = doi.replace(/[.,;:'"!?]+$/, '');
  doi = doi.replace(/\/(full|pdf|abstract|epdf|html|meta|suppl|figures|references)(?:\/.*)?$/i, '');

  // Balance trailing closing parenthesis if unmatched
  const openCount = (doi.match(/\(/g) ?? []).length;
  const closeCount = (doi.match(/\)/g) ?? []).length;
  if (closeCount > openCount && doi.endsWith(')')) {
    doi = doi.slice(0, -1);
  }

  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}

function extractDoiFromUrlString(inputUrl: string): string | null {
  try {
    const u = new URL(inputUrl);
    // Check query parameters like ?id=10.1371/journal.pone.0115069 or ?doi=...
    for (const [, val] of u.searchParams.entries()) {
      const found = cleanDoi(val);
      if (found) return found;
    }
    const pathAndHash = decodeURIComponent(u.pathname + u.hash);
    const match = pathAndHash.match(DOI_PATTERN);
    if (match) {
      return cleanDoi(match[0]);
    }
  } catch {
    return cleanDoi(inputUrl);
  }
  return null;
}

async function verifyDoiExistsInCrossref(doi: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'AcademicArticleExplorer/1.0 (mailto:support@example.org)' },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchMetadataFromCrossrefAndOpenAlex(doi: string): Promise<{
  metadata: ArticleMetadata;
  openAccessPdfUrl: string | null;
}> {
  const empty: ArticleMetadata = {
    title: null,
    authors: [],
    journal: null,
    year: null,
    volume: null,
    issue: null,
    pages: null,
    citedByCount: null,
    publisher: null,
    abstract: null,
    citation: null,
  };

  let openAccessPdfUrl: string | null = null;

  const [crResult, oaResult] = await Promise.allSettled([
    fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
      signal: AbortSignal.timeout(6000),
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
      signal: AbortSignal.timeout(6000),
    }).then((r) => (r.ok ? r.json() : null)),
  ]);

  if (crResult.status === 'fulfilled' && crResult.value?.message) {
    const m = crResult.value.message;
    if (Array.isArray(m.title) && m.title[0]) {
      empty.title = String(m.title[0]).replace(/<[^>]+>/g, '').trim();
    }
    if (Array.isArray(m.author)) {
      empty.authors = m.author
        .slice(0, 8)
        .map((a: { given?: string; family?: string; name?: string }) =>
          [a.given, a.family].filter(Boolean).join(' ') || a.name || ''
        )
        .filter(Boolean);
    }
    if (Array.isArray(m['container-title']) && m['container-title'][0]) {
      empty.journal = String(m['container-title'][0]).trim();
    }
    const yearParts =
      m.published?.['date-parts']?.[0] ??
      m['published-print']?.['date-parts']?.[0] ??
      m['published-online']?.['date-parts']?.[0];
    if (Array.isArray(yearParts) && yearParts[0]) {
      empty.year = String(yearParts[0]);
    }
    if (m.volume) {
      empty.volume = String(m.volume);
    }
    if (m.issue) {
      empty.issue = String(m.issue);
    }
    if (m.page) {
      empty.pages = String(m.page);
    }
    if (typeof m['is-referenced-by-count'] === 'number') {
      empty.citedByCount = m['is-referenced-by-count'];
    }
    if (m.publisher) {
      empty.publisher = String(m.publisher);
    }
    if (m.abstract) {
      empty.abstract = String(m.abstract).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (Array.isArray(m.link)) {
      const pdfLink = m.link.find(
        (l: { 'content-type'?: string; URL?: string }) =>
          l['content-type'] === 'application/pdf' && typeof l.URL === 'string'
      );
      if (pdfLink?.URL) {
        openAccessPdfUrl = pdfLink.URL;
      }
    }
  }

  if (oaResult.status === 'fulfilled' && oaResult.value) {
    const oa = oaResult.value;
    if (!empty.title && oa.title) empty.title = String(oa.title);
    if (empty.authors.length === 0 && Array.isArray(oa.authorships)) {
      empty.authors = oa.authorships
        .slice(0, 8)
        .map((a: { author?: { display_name?: string } }) => a.author?.display_name ?? '')
        .filter(Boolean);
    }
    if (!empty.journal && oa.primary_location?.source?.display_name) {
      empty.journal = String(oa.primary_location.source.display_name);
    }
    if (!empty.year && oa.publication_year) {
      empty.year = String(oa.publication_year);
    }
    const oaPdf = oa.best_oa_location?.pdf_url ?? oa.primary_location?.pdf_url ?? null;
    if (typeof oaPdf === 'string' && oaPdf.startsWith('http') && !oaPdf.toLowerCase().endsWith('.html')) {
      if (!openAccessPdfUrl || oaPdf.toLowerCase().includes('.pdf')) {
        openAccessPdfUrl = oaPdf;
      }
    }
  }

  if (/^10\.48550\/arXiv\./i.test(doi)) {
    const arxId = doi.replace(/^10\.48550\/arXiv\./i, '');
    openAccessPdfUrl = `https://arxiv.org/pdf/${arxId}.pdf`;
  }

  if (empty.title) {
    const firstAuthors = empty.authors.slice(0, 3).join(', ') + (empty.authors.length > 3 ? ' et al.' : '');
    empty.citation = [
      firstAuthors,
      empty.year ? `(${empty.year})` : null,
      empty.title,
      empty.journal,
      `https://doi.org/${doi}`,
    ]
      .filter(Boolean)
      .join('. ');
  }

  return { metadata: empty, openAccessPdfUrl };
}

async function resolveDoiFromUrl(input: string): Promise<{
  doi: string | null;
  source: string | null;
  normalizedUrl: string | null;
  pageMetadata: Partial<ArticleMetadata>;
}> {
  const trimmed = input.trim();
  const pageMetadata: Partial<ArticleMetadata> = {};

  // 1. Check if input itself is a direct DOI or doi.org URL
  if (/^(?:doi:\s*)?10\.\d{4,9}\//i.test(trimmed) || /^https?:\/\/(?:dx\.)?doi\.org\//i.test(trimmed)) {
    const direct = cleanDoi(trimmed);
    if (direct) {
      return {
        doi: direct,
        source: 'معرّف DOI مباشر',
        normalizedUrl: `https://doi.org/${direct}`,
        pageMetadata,
      };
    }
  }

  // Ensure URL has scheme
  let candidateUrl = trimmed;
  if (!/^https?:\/\//i.test(candidateUrl)) {
    candidateUrl = `https://${candidateUrl}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = await assertSafePublicUrl(candidateUrl);
  } catch {
    return { doi: null, source: null, normalizedUrl: null, pageMetadata };
  }

  const host = parsedUrl.hostname.toLowerCase();

  // 2. arXiv special handling (10.48550/arXiv.<id>)
  if (host === 'arxiv.org' || host.endsWith('.arxiv.org')) {
    const arxMatch = parsedUrl.pathname.match(/\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+\/\d{7}(?:v\d+)?)/i);
    if (arxMatch) {
      const arxId = arxMatch[1].replace(/v\d+$/i, '');
      return {
        doi: `10.48550/arXiv.${arxId}`,
        source: 'رابط arXiv',
        normalizedUrl: parsedUrl.toString(),
        pageMetadata,
      };
    }
  }

  // 3. PubMed special handling
  if (host === 'pubmed.ncbi.nlm.nih.gov' || (host === 'ncbi.nlm.nih.gov' && parsedUrl.pathname.includes('/pubmed/'))) {
    const pmidMatch = parsedUrl.pathname.match(/\/(\d{5,10})\/?/);
    if (pmidMatch) {
      try {
        const res = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmidMatch[1]}&retmode=json`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const data = await res.json();
          const record = data?.result?.[pmidMatch[1]];
          const doiObj = Array.isArray(record?.articleids)
            ? record.articleids.find((x: { idtype?: string; value?: string }) => x.idtype === 'doi')
            : null;
          if (doiObj?.value) {
            const d = cleanDoi(doiObj.value);
            if (d) {
              return {
                doi: d,
                source: 'قاعدة بيانات PubMed',
                normalizedUrl: parsedUrl.toString(),
                pageMetadata: {
                  title: record.title ?? null,
                  journal: record.fulljournalname ?? record.source ?? null,
                },
              };
            }
          }
        }
      } catch {
        // continue to general extraction
      }
    }
  }

  // 4. PMC special handling
  if (host === 'pmc.ncbi.nlm.nih.gov' || host === 'www.ncbi.nlm.nih.gov') {
    const pmcMatch = parsedUrl.pathname.match(/\/(PMC\d+)\b/i);
    if (pmcMatch) {
      try {
        const res = await fetch(
          `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?ids=${pmcMatch[1].toUpperCase()}&format=json`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const data = await res.json();
          const doiVal = data?.records?.[0]?.doi;
          if (doiVal) {
            const d = cleanDoi(doiVal);
            if (d) {
              return {
                doi: d,
                source: 'قاعدة بيانات PubMed Central',
                normalizedUrl: parsedUrl.toString(),
                pageMetadata,
              };
            }
          }
        }
      } catch {
        // continue
      }
    }
  }

  // 5. DOI embedded directly in the URL path or query params
  const urlDoi = extractDoiFromUrlString(parsedUrl.toString());
  if (urlDoi) {
    return {
      doi: urlDoi,
      source: 'رابط المقالة مباشرة',
      normalizedUrl: parsedUrl.toString(),
      pageMetadata,
    };
  }

  // 6. Fetch HTML page and parse academic meta tags / JSON-LD / DOI patterns
  try {
    const { response, finalUrl } = await safeFetch(parsedUrl.toString(), { timeoutMs: 10000 });
    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.includes('text/html')) {
      const html = await readTextLimited(response);
      const $ = cheerio.load(html);

      const metaTitle =
        $('meta[name="citation_title"]').attr('content') ||
        $('meta[property="og:title"]').attr('content') ||
        $('title').text() ||
        null;
      if (metaTitle) pageMetadata.title = metaTitle.trim();

      const metaJournal = $('meta[name="citation_journal_title"]').attr('content');
      if (metaJournal) pageMetadata.journal = metaJournal.trim();

      const metaDate = $('meta[name="citation_publication_date"]').attr('content') || $('meta[name="citation_date"]').attr('content');
      if (metaDate) {
        const y = metaDate.match(/\b(19|20)\d{2}\b/);
        if (y) pageMetadata.year = y[0];
      }

      const metaAuthors: string[] = [];
      $('meta[name="citation_author"]').each((_, el) => {
        const val = $(el).attr('content')?.trim();
        if (val) metaAuthors.push(val);
      });
      if (metaAuthors.length > 0) pageMetadata.authors = metaAuthors.slice(0, 8);

      const metaSelectors = [
        'meta[name="citation_doi"]',
        'meta[name="dc.identifier"]',
        'meta[name="dc.Identifier"]',
        'meta[name="DC.Identifier"]',
        'meta[name="DC.identifier"]',
        'meta[name="prism.doi"]',
        'meta[name="bepress_citation_doi"]',
        'meta[name="rft_id"]',
        'meta[property="citation_doi"]',
        'meta[property="og:url"]',
      ];

      for (const selector of metaSelectors) {
        const elements = $(selector);
        for (let i = 0; i < elements.length; i++) {
          const content = $(elements[i]).attr('content');
          if (content) {
            const parsedDoi = cleanDoi(content);
            if (parsedDoi) {
              return {
                doi: parsedDoi,
                source: 'الوسوم الوصفية لصفحة المقالة (Meta Tags)',
                normalizedUrl: finalUrl,
                pageMetadata,
              };
            }
          }
        }
      }

      // Check JSON-LD blocks
      const ldScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < ldScripts.length; i++) {
        const txt = $(ldScripts[i]).html() ?? '';
        const found = cleanDoi(txt);
        if (found) {
          return {
            doi: found,
            source: 'بيانات JSON-LD داخل الصفحة',
            normalizedUrl: finalUrl,
            pageMetadata,
          };
        }
      }

      // Check canonical link or doi.org anchor near top of page
      const canonical = $('link[rel="canonical"]').attr('href');
      if (canonical) {
        const cDoi = extractDoiFromUrlString(canonical);
        if (cDoi) {
          return {
            doi: cDoi,
            source: 'الرابط الأساسي للصفحة (Canonical)',
            normalizedUrl: finalUrl,
            pageMetadata,
          };
        }
      }

      const doiAnchor = $('a[href*="doi.org/10."]').first().attr('href');
      if (doiAnchor) {
        const aDoi = cleanDoi(doiAnchor);
        if (aDoi) {
          return {
            doi: aDoi,
            source: 'رابط DOI داخل الصفحة',
            normalizedUrl: finalUrl,
            pageMetadata,
          };
        }
      }
    }
  } catch {
    // Continue to publisher URL heuristics & Crossref lookup
  }

  // 7. Publisher-specific URL -> Crossref verified fallbacks (handles Cloudflare-protected publishers)
  // Nature: https://www.nature.com/articles/s41586-020-2649-2 -> 10.1038/s41586-020-2649-2
  if (host.includes('nature.com')) {
    const natureMatch = parsedUrl.pathname.match(/\/articles\/([A-Za-z0-9._-]+)/);
    if (natureMatch) {
      const candidate = `10.1038/${natureMatch[1]}`;
      if (await verifyDoiExistsInCrossref(candidate)) {
        return {
          doi: candidate,
          source: 'معرّف Nature عبر Crossref',
          normalizedUrl: parsedUrl.toString(),
          pageMetadata,
        };
      }
    }
  }

  // ScienceDirect / Cell PII lookup via Crossref alternative-id
  if (host.includes('sciencedirect.com') || host.includes('cell.com')) {
    const piiMatch = parsedUrl.pathname.match(/\/(?:pii|fulltext)\/([A-Z0-9]{10,25})/i);
    if (piiMatch) {
      try {
        const res = await fetch(
          `https://api.crossref.org/works?filter=alternative-id:${encodeURIComponent(piiMatch[1].toUpperCase())}&rows=1`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const data = await res.json();
          const item = data?.message?.items?.[0];
          if (item?.DOI) {
            return {
              doi: String(item.DOI),
              source: 'معرّف ScienceDirect PII عبر Crossref',
              normalizedUrl: parsedUrl.toString(),
              pageMetadata,
            };
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Title fallback via Crossref if we managed to scrape a clean title
  if (pageMetadata.title && pageMetadata.title.length > 15) {
    try {
      const res = await fetch(
        `https://api.crossref.org/works?query.title=${encodeURIComponent(pageMetadata.title)}&rows=1`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.message?.items?.[0];
        if (item?.DOI) {
          return {
            doi: String(item.DOI),
            source: 'مطابقة عنوان المقالة عبر Crossref',
            normalizedUrl: parsedUrl.toString(),
            pageMetadata,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    doi: null,
    source: null,
    normalizedUrl: parsedUrl.toString(),
    pageMetadata,
  };
}

function resolveAbsoluteUrl(raw: string, baseOrigin: string): string | null {
  const cleaned = raw.replace(/\\\//g, '/').split('#')[0].trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('//')) return `https:${cleaned}`;
  if (cleaned.startsWith('/')) return `${baseOrigin}${cleaned}`;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  return `${baseOrigin}/${cleaned}`;
}

function parseSciHubPage(html: string, baseOrigin: string, doi: string): {
  found: boolean;
  pdfUrl: string | null;
  openAccessPdfUrl: string | null;
  fileSize: string | null;
  sha256: string | null;
  md5: string | null;
  title: string | null;
  abstract: string | null;
  citation: string | null;
} {
  const $ = cheerio.load(html);

  let pdfUrl: string | null = null;

  // Classic Sci-Hub embed / iframe / save button patterns
  const embedSrc = $('iframe#pdf, embed#pdf, iframe[src*=".pdf"], embed[type="application/pdf"]').attr('src');
  if (embedSrc) {
    pdfUrl = resolveAbsoluteUrl(embedSrc, baseOrigin);
  }

  if (!pdfUrl) {
    const onclickMatch = html.match(/location\.href\s*=\s*['"]([^'"]+\.pdf[^'"]*)['"]/i);
    if (onclickMatch?.[1]) {
      pdfUrl = resolveAbsoluteUrl(onclickMatch[1], baseOrigin);
    }
  }

  // Modern Sci-Hub record layout (.value.files .record + a.open)
  let openAccessPdfUrl: string | null = null;
  const openHref = $('a.open').attr('href');
  if (openHref) {
    openAccessPdfUrl = resolveAbsoluteUrl(openHref, baseOrigin);
  }

  let sha256: string | null = null;
  let md5: string | null = null;
  let fileSize: string | null = null;

  const detailsDivs = $('.record .details > div');
  for (let i = 0; i < detailsDivs.length - 1; i += 2) {
    const label = $(detailsDivs[i]).text().trim().toLowerCase();
    const val = $(detailsDivs[i + 1]).text().trim();
    if (label === 'sha256' && /^[a-f0-9]{64}$/i.test(val)) sha256 = val;
    if (label === 'md5' && /^[a-f0-9]{32}$/i.test(val)) md5 = val;
    if (label === 'size' && val) fileSize = val;
  }

  // Fallback check if Sci-Hub has a /downloads/ or /storage/ link
  if (!pdfUrl) {
    const dlHref = $('a[href*="/downloads/"], a[href*="/storage/"]').first().attr('href');
    if (dlHref) {
      pdfUrl = resolveAbsoluteUrl(dlHref, baseOrigin);
    }
  }

  const versionHref = $('.record .view a').attr('href');
  const hasRecord = Boolean(sha256 || md5 || versionHref || pdfUrl);
  const notFoundSignals =
    html.includes('Unfortunately, Sci-Hub') ||
    html.includes('article not found') ||
    html.includes('не найдена') ||
    html.includes('DDoS-Guard') ||
    html.includes('challenges.cloudflare.com');

  const title = $('.value.title').text().trim() || $('meta[name="citation_title"]').attr('content')?.trim() || null;
  const abstract = $('.value.abstract').text().trim() || null;
  const citation = $('.cite .formatted').text().trim() || null;

  return {
    found: (hasRecord || Boolean(openAccessPdfUrl)) && !notFoundSignals,
    pdfUrl: pdfUrl ?? openAccessPdfUrl,
    openAccessPdfUrl,
    fileSize,
    sha256,
    md5,
    title,
    abstract,
    citation,
  };
}

async function verifyPdfStream(rawUrl: string, refererUrl?: string): Promise<boolean> {
  try {
    const { response } = await safeFetch(rawUrl, {
      headers: {
        Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        Referer: refererUrl ?? 'https://sci-hub.box/',
      },
      timeoutMs: 8000,
    });
    if (!response.ok) return false;
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const reader = response.body?.getReader();
    if (!reader) return contentType.includes('application/pdf');
    const { value } = await reader.read();
    await reader.cancel().catch(() => {});
    if (!value || value.byteLength < 5) return false;
    const head = Buffer.from(value.subarray(0, Math.min(32, value.byteLength))).toString('ascii');
    return head.includes('%PDF-');
  } catch {
    return false;
  }
}

async function fetchUnpaywallPdfCandidates(doi: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=academic.explorer@example.org`,
      {
        headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
        signal: AbortSignal.timeout(4500),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const urls = new Set<string>();
    if (typeof data?.best_oa_location?.url_for_pdf === 'string') {
      urls.add(data.best_oa_location.url_for_pdf);
    }
    if (Array.isArray(data?.oa_locations)) {
      for (const loc of data.oa_locations) {
        if (typeof loc?.url_for_pdf === 'string') {
          urls.add(loc.url_for_pdf);
        }
      }
    }
    return Array.from(urls).filter((u) => u.startsWith('http'));
  } catch {
    return [];
  }
}

async function extractDirectPdfFromArticlePage(articleUrl: string): Promise<string[]> {
  if (!articleUrl || !articleUrl.startsWith('http')) return [];
  try {
    const { response, finalUrl } = await safeFetch(articleUrl, { timeoutMs: 6500 });
    if (!response.ok) return [];
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('application/pdf')) {
      return [finalUrl];
    }
    if (!contentType.includes('text/html')) return [];

    const html = await readTextLimited(response, 1024 * 1024);
    const $ = cheerio.load(html);
    const origin = new URL(finalUrl).origin;
    const candidates = new Set<string>();

    const addRel = (raw?: string | null, isStrictMeta = false) => {
      if (!raw) return;
      const abs = resolveAbsoluteUrl(raw, origin);
      if (!abs || abs.includes('sci-hub')) return;
      if (!isStrictMeta) {
        const lower = abs.toLowerCase();
        if (
          lower.includes('/esm/') ||
          lower.includes('moesm') ||
          lower.includes('_esm') ||
          lower.includes('suppl') ||
          lower.includes('supporting') ||
          lower.includes('appendix')
        ) {
          return;
        }
      }
      candidates.add(abs);
    };

    addRel($('meta[name="citation_pdf_url"]').attr('content'), true);
    addRel($('meta[property="citation_pdf_url"]').attr('content'), true);
    addRel($('meta[name="eprints.document_url"]').attr('content'), true);
    addRel($('link[rel="alternate"][type="application/pdf"]').attr('href'), true);

    $('a[href*=".pdf"], a[href*="/pdf/"], a[href*="blobtype=pdf"], a[href*="type=printable"]').each(
      (_, el) => {
        if (candidates.size >= 6) return;
        const linkText = $(el).text().toLowerCase();
        if (
          linkText.includes('supplement') ||
          linkText.includes('appendix') ||
          linkText.includes('supporting')
        ) {
          return;
        }
        addRel($(el).attr('href'), false);
      }
    );

    return Array.from(candidates);
  } catch {
    return [];
  }
}

async function searchSciHub(doi: string, openAccessFallback: string | null): Promise<{
  record: SciHubRecord;
  extraMeta: Partial<ArticleMetadata>;
}> {
  const sciHubBoxBase = 'https://sci-hub.box';
  const sciHubBoxUrl = `${sciHubBoxBase}/${doi}`;
  const extraMeta: Partial<ArticleMetadata> = {};
  let challengeDetected = false;
  const candidateSet = new Set<string>();

  const addCandidate = (u: string | null | undefined) => {
    if (!u || typeof u !== 'string') return;
    const trimmed = u.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      candidateSet.add(trimmed);
    }
  };

  // 1. Primary search on https://sci-hub.box/
  try {
    const { response } = await safeFetch(`${sciHubBoxBase}/${encodeURI(doi)}`, { timeoutMs: 7000 });
    const html = await readTextLimited(response);
    if (html.includes('DDoS-Guard') || response.status === 403) {
      challengeDetected = true;
    } else if (response.ok && html.length > 500) {
      const parsed = parseSciHubPage(html, sciHubBoxBase, doi);
      if (parsed.title) extraMeta.title = parsed.title;
      if (parsed.abstract) extraMeta.abstract = parsed.abstract;
      if (parsed.citation) extraMeta.citation = parsed.citation;

      if (parsed.found) {
        addCandidate(parsed.pdfUrl);
        addCandidate(parsed.openAccessPdfUrl);
        addCandidate(openAccessFallback);
        const pdfCandidates = Array.from(candidateSet);
        return {
          record: {
            available: true,
            checkedSource: 'sci-hub.box',
            sciHubBoxUrl,
            sciHubBoxChallengeDetected: false,
            pdfUrl: pdfCandidates[0] ?? null,
            pdfCandidates,
            openAccessPdfUrl: parsed.openAccessPdfUrl ?? openAccessFallback,
            fileSize: parsed.fileSize,
            sha256: parsed.sha256,
            md5: parsed.md5,
            message: 'المقالة متوفرة في موقع sci-hub.box ويمكنك تحميل ملف PDF الآن.',
          },
          extraMeta,
        };
      }
    }
  } catch {
    challengeDetected = true;
  }

  // 2. Fallback check across official Sci-Hub mirrors (prioritizing direct PDF embed mirrors first)
  const mirrors = ['https://sci-hub.ren', 'https://sci-hub.vg', 'https://sci-hub.ru', 'https://sci-hub.st'];
  let foundInArchive = false;
  let archiveDirectPdf: string | null = null;
  let archiveOpenAccess: string | null = null;
  let archiveSize: string | null = null;
  let archiveSha256: string | null = null;
  let archiveMd5: string | null = null;

  for (const mirror of mirrors) {
    try {
      const { response } = await safeFetch(`${mirror}/${encodeURI(doi)}`, { timeoutMs: 6500 });
      if (response.status >= 300 && response.status < 400) {
        continue;
      }
      if (!response.ok) continue;
      const html = await readTextLimited(response);
      if (html.includes('DDoS-Guard') || html.includes('challenges.cloudflare.com') || html.includes('<title>Verification')) {
        continue;
      }

      const parsed = parseSciHubPage(html, mirror, doi);
      if (parsed.title && !extraMeta.title) extraMeta.title = parsed.title;
      if (parsed.abstract && !extraMeta.abstract) extraMeta.abstract = parsed.abstract;
      if (parsed.citation && !extraMeta.citation) extraMeta.citation = parsed.citation;

      if (parsed.found) {
        foundInArchive = true;
        if (parsed.pdfUrl && parsed.pdfUrl !== parsed.openAccessPdfUrl) {
          addCandidate(parsed.pdfUrl);
          if (!archiveDirectPdf) archiveDirectPdf = parsed.pdfUrl;
        }
        if (parsed.openAccessPdfUrl && !archiveOpenAccess) {
          archiveOpenAccess = parsed.openAccessPdfUrl;
        }
        if (parsed.fileSize && !archiveSize) archiveSize = parsed.fileSize;
        if (parsed.sha256 && !archiveSha256) archiveSha256 = parsed.sha256;
        if (parsed.md5 && !archiveMd5) archiveMd5 = parsed.md5;

        // Break early only when we got a genuine Sci-Hub storage/embed PDF URL
        if (archiveDirectPdf && (archiveDirectPdf.includes('sci.bban.top') || archiveDirectPdf.includes('/downloads/') || archiveDirectPdf.includes('/storage/'))) {
          break;
        }
      }
    } catch {
      // try next mirror
    }
  }

  if (foundInArchive) {
    addCandidate(`https://sci.bban.top/pdf/${encodeURI(doi)}.pdf?download=true`);
    addCandidate(archiveOpenAccess);
  }
  addCandidate(openAccessFallback);

  const pdfCandidates = Array.from(candidateSet);
  const bestPdf = archiveDirectPdf ?? pdfCandidates[0] ?? null;

  if (foundInArchive) {
    return {
      record: {
        available: true,
        checkedSource: 'sci-hub-archive',
        sciHubBoxUrl,
        sciHubBoxChallengeDetected: challengeDetected,
        pdfUrl: bestPdf,
        pdfCandidates,
        openAccessPdfUrl: archiveOpenAccess ?? openAccessFallback,
        fileSize: archiveSize,
        sha256: archiveSha256,
        md5: archiveMd5,
        message: 'المقالة متوفرة ومفهرسة في أرشيف Sci-Hub. يمكنك تحميل ملف PDF الآن.',
      },
      extraMeta,
    };
  }

  if (openAccessFallback) {
    return {
      record: {
        available: true,
        checkedSource: 'open-access',
        sciHubBoxUrl,
        sciHubBoxChallengeDetected: challengeDetected,
        pdfUrl: openAccessFallback,
        pdfCandidates,
        openAccessPdfUrl: openAccessFallback,
        fileSize: null,
        sha256: null,
        md5: null,
        message: 'تتوفر نسخة مجانية مفتوحة الوصول (Open Access) بصيغة PDF.',
      },
      extraMeta,
    };
  }

  return {
    record: {
      available: false,
      checkedSource: 'none',
      sciHubBoxUrl,
      sciHubBoxChallengeDetected: challengeDetected,
      pdfUrl: null,
      pdfCandidates: [],
      openAccessPdfUrl: null,
      fileSize: null,
      sha256: null,
      md5: null,
      message: 'هذه المقالة غير موجودة على موقع Sci-Hub بصيغة PDF — المقالة مدفوعة وغير مجانية ولا يمكن تحميلها.',
    },
    extraMeta,
  };
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'with', 'by', 'from', 'as', 'at', 'is', 'are', 'using', 'based', 'via', 'study', 'analysis',
  'في', 'من', 'على', 'إلى', 'الى', 'عن', 'مع', 'أو', 'او', 'و', 'ال', 'بين', 'حول', 'دراسة', 'بحث', 'تحليل',
]);

function normalizeArabicChars(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function normalizeTextTokens(text: string): string[] {
  return normalizeArabicChars(text.toLowerCase())
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function computeTitleSimilarity(query: string, candidateTitle: string): number {
  const qNorm = normalizeArabicChars(query.toLowerCase()).replace(/\s+/g, ' ').trim();
  const tNorm = normalizeArabicChars(candidateTitle.toLowerCase()).replace(/\s+/g, ' ').trim();
  if (!qNorm || !tNorm) return 0;
  if (qNorm === tNorm) return 100;

  const qTokens = normalizeTextTokens(qNorm);
  const tTokens = normalizeTextTokens(tNorm);
  if (qTokens.length === 0 || tTokens.length === 0) return 15;

  let matchedWeight = 0;
  for (const qt of qTokens) {
    if (tTokens.includes(qt)) {
      matchedWeight += 1;
    } else if (
      qt.length >= 4 &&
      tTokens.some((tt) => tt.startsWith(qt.slice(0, 4)) || qt.startsWith(tt.slice(0, 4)))
    ) {
      matchedWeight += 0.65;
    }
  }

  // Consecutive bigram bonus for multi-word research title accuracy
  let bigramBonus = 0;
  if (qTokens.length >= 2 && tTokens.length >= 2) {
    const tBigrams = new Set<string>();
    for (let i = 0; i < tTokens.length - 1; i++) {
      tBigrams.add(`${tTokens[i]} ${tTokens[i + 1]}`);
    }
    let bigramHits = 0;
    for (let i = 0; i < qTokens.length - 1; i++) {
      if (tBigrams.has(`${qTokens[i]} ${qTokens[i + 1]}`)) {
        bigramHits += 1;
      }
    }
    bigramBonus = (bigramHits / (qTokens.length - 1)) * 0.18;
  }

  const recall = matchedWeight / qTokens.length;
  const precision = matchedWeight / Math.max(tTokens.length, qTokens.length);
  const phraseBonus = tNorm.includes(qNorm) || qNorm.includes(tNorm) ? 0.16 : 0;

  const rawScore = (recall * 0.58 + precision * 0.22 + bigramBonus + phraseBonus) * 100;
  return Math.min(99, Math.max(10, Math.round(rawScore)));
}

function buildOpenAlexYearFilter(yearFrom?: number | null, yearTo?: number | null): string {
  if (yearFrom && yearTo) return `publication_year:${yearFrom}-${yearTo}`;
  if (yearFrom) return `publication_year:>${yearFrom - 1}`;
  if (yearTo) return `publication_year:<${yearTo + 1}`;
  return '';
}

function mapOpenAlexWork(
  query: string,
  w: {
    id?: string;
    doi?: string;
    title?: string;
    publication_date?: string;
    publication_year?: number;
    cited_by_count?: number;
    authorships?: Array<{ author?: { display_name?: string } }>;
    primary_location?: { landing_page_url?: string; pdf_url?: string; source?: { display_name?: string } };
    best_oa_location?: { pdf_url?: string; landing_page_url?: string };
    locations?: Array<{ pdf_url?: string; landing_page_url?: string }>;
  }
): SearchArticleResult {
  const doi = w.doi ? cleanDoi(String(w.doi)) : null;
  const landing =
    w.primary_location?.landing_page_url ??
    w.best_oa_location?.landing_page_url ??
    (doi ? `https://doi.org/${doi}` : w.id ?? '');

  const candidateSet = new Set<string>();
  const addPdf = (u?: string | null) => {
    if (typeof u === 'string' && u.startsWith('http') && !u.toLowerCase().endsWith('.html')) {
      candidateSet.add(u);
    }
  };
  addPdf(w.best_oa_location?.pdf_url);
  addPdf(w.primary_location?.pdf_url);
  if (Array.isArray(w.locations)) {
    for (const loc of w.locations) {
      addPdf(loc.pdf_url);
    }
  }
  const pdfCandidates = Array.from(candidateSet);
  const title = String(w.title).replace(/<[^>]+>/g, '').trim();

  return {
    id: `oa-${doi ?? w.id ?? title}`,
    title,
    authors: Array.isArray(w.authorships)
      ? w.authorships.slice(0, 5).map((a) => a.author?.display_name ?? '').filter(Boolean)
      : [],
    publishedDate: w.publication_date ? String(w.publication_date) : w.publication_year ? String(w.publication_year) : null,
    year: w.publication_year ? String(w.publication_year) : null,
    articleUrl: String(landing),
    doi,
    sourceEngine: 'OpenAlex',
    venue: w.primary_location?.source?.display_name ? String(w.primary_location.source.display_name) : null,
    citedByCount: typeof w.cited_by_count === 'number' ? w.cited_by_count : null,
    abstract: null,
    openAccessPdfUrl: pdfCandidates[0] ?? null,
    pdfCandidates,
    similarityScore: computeTitleSimilarity(query, title),
  };
}

async function searchOpenAlex(
  query: string,
  yearFrom?: number | null,
  yearTo?: number | null
): Promise<SearchArticleResult[]> {
  const yf = buildOpenAlexYearFilter(yearFrom, yearTo);
  const titleFilter = yf
    ? `title.search:${encodeURIComponent(query)},${yf}`
    : `title.search:${encodeURIComponent(query)}`;
  const searchUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}${
    yf ? `&filter=${yf}` : ''
  }&per-page=12&sort=relevance_score:desc`;
  const titleUrl = `https://api.openalex.org/works?filter=${titleFilter}&per-page=10&sort=cited_by_count:desc`;

  const [sRes, tRes] = await Promise.allSettled([
    fetch(searchUrl, {
      headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
      signal: AbortSignal.timeout(6500),
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(titleUrl, {
      headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
      signal: AbortSignal.timeout(6500),
    }).then((r) => (r.ok ? r.json() : null)),
  ]);

  const combined = [
    ...(tRes.status === 'fulfilled' && Array.isArray(tRes.value?.results) ? tRes.value.results : []),
    ...(sRes.status === 'fulfilled' && Array.isArray(sRes.value?.results) ? sRes.value.results : []),
  ];

  return combined
    .filter((w: { title?: string }) => Boolean(w?.title))
    .map((w) => mapOpenAlexWork(query, w));
}

async function searchCrossref(
  query: string,
  yearFrom?: number | null,
  yearTo?: number | null
): Promise<SearchArticleResult[]> {
  const filters: string[] = [];
  if (yearFrom) filters.push(`from-pub-date:${yearFrom}-01-01`);
  if (yearTo) filters.push(`until-pub-date:${yearTo}-12-31`);
  const filterParam = filters.length > 0 ? `&filter=${filters.join(',')}` : '';

  const titleUrl = `https://api.crossref.org/works?query.title=${encodeURIComponent(
    query
  )}${filterParam}&rows=14&sort=relevance`;
  const res = await fetch(titleUrl, {
    headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data?.message?.items) ? data.message.items : [];

  return items
    .filter((m: { title?: string[] }) => Array.isArray(m?.title) && Boolean(m.title[0]))
    .map((m: {
      DOI?: string;
      URL?: string;
      title?: string[];
      author?: Array<{ given?: string; family?: string; name?: string }>;
      'container-title'?: string[];
      publisher?: string;
      published?: { 'date-parts'?: number[][] };
      'published-print'?: { 'date-parts'?: number[][] };
      'published-online'?: { 'date-parts'?: number[][] };
      'is-referenced-by-count'?: number;
      abstract?: string;
      link?: Array<{ 'content-type'?: string; URL?: string }>;
    }) => {
      const doi = m.DOI ? cleanDoi(String(m.DOI)) : null;
      const title = String(m.title![0]).replace(/<[^>]+>/g, '').trim();
      const parts =
        m.published?.['date-parts']?.[0] ??
        m['published-online']?.['date-parts']?.[0] ??
        m['published-print']?.['date-parts']?.[0];
      const publishedDate = Array.isArray(parts) && parts.length > 0
        ? parts.map((n, idx) => (idx === 0 ? String(n) : String(n).padStart(2, '0'))).join('-')
        : null;
      const year = Array.isArray(parts) && parts[0] ? String(parts[0]) : null;
      const pdfLinks = Array.isArray(m.link)
        ? m.link
            .filter(
              (l) =>
                typeof l.URL === 'string' &&
                l.URL.startsWith('http') &&
                (l['content-type'] === 'application/pdf' || l.URL.toLowerCase().includes('.pdf'))
            )
            .map((l) => l.URL!)
        : [];

      return {
        id: `cr-${doi ?? title}`,
        title,
        authors: Array.isArray(m.author)
          ? m.author
              .slice(0, 5)
              .map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '')
              .filter(Boolean)
          : [],
        publishedDate,
        year,
        articleUrl: m.URL ? String(m.URL) : doi ? `https://doi.org/${doi}` : '',
        doi,
        sourceEngine: 'Crossref',
        venue: Array.isArray(m['container-title']) && m['container-title'][0]
          ? String(m['container-title'][0])
          : m.publisher ?? null,
        citedByCount: typeof m['is-referenced-by-count'] === 'number' ? m['is-referenced-by-count'] : null,
        abstract: m.abstract ? String(m.abstract).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
        openAccessPdfUrl: pdfLinks[0] ?? null,
        pdfCandidates: pdfLinks,
        similarityScore: computeTitleSimilarity(query, title),
      } satisfies SearchArticleResult;
    });
}

async function searchEuropePmc(
  query: string,
  yearFrom?: number | null,
  yearTo?: number | null
): Promise<SearchArticleResult[]> {
  let epmcQuery = query;
  if (yearFrom || yearTo) {
    const fromY = yearFrom ?? 1900;
    const toY = yearTo ?? new Date().getFullYear() + 1;
    epmcQuery = `(${query}) AND (PUB_YEAR:[${fromY} TO ${toY}])`;
  }
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
    epmcQuery
  )}&resultType=lite&pageSize=12&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.resultList?.result) ? data.resultList.result : [];

  return list
    .filter((item: { title?: string }) => Boolean(item?.title))
    .map((item: {
      id?: string;
      source?: string;
      pmid?: string;
      pmcid?: string;
      doi?: string;
      title?: string;
      authorString?: string;
      journalTitle?: string;
      pubYear?: string;
      firstPublicationDate?: string;
      citedByCount?: number;
      isOpenAccess?: string;
    }) => {
      const doi = item.doi ? cleanDoi(String(item.doi)) : null;
      const title = String(item.title).replace(/<[^>]+>/g, '').trim();
      const articleUrl = doi
        ? `https://doi.org/${doi}`
        : item.pmcid
        ? `https://europepmc.org/article/PMC/${item.pmcid}`
        : item.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`
        : `https://europepmc.org/article/${item.source ?? 'MED'}/${item.id ?? ''}`;

      const oaPdf =
        item.pmcid && item.isOpenAccess === 'Y'
          ? `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${item.pmcid}&blobtype=pdf`
          : null;

      return {
        id: `epmc-${doi ?? item.id ?? title}`,
        title,
        authors: item.authorString
          ? String(item.authorString).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5)
          : [],
        publishedDate: item.firstPublicationDate ? String(item.firstPublicationDate) : item.pubYear ?? null,
        year: item.pubYear ? String(item.pubYear) : null,
        articleUrl,
        doi,
        sourceEngine: 'Europe PMC',
        venue: item.journalTitle ? String(item.journalTitle) : null,
        citedByCount: typeof item.citedByCount === 'number' ? item.citedByCount : null,
        abstract: null,
        openAccessPdfUrl: oaPdf,
        pdfCandidates: oaPdf ? [oaPdf] : [],
        similarityScore: computeTitleSimilarity(query, title),
      } satisfies SearchArticleResult;
    });
}

async function searchArxiv(
  query: string,
  yearFrom?: number | null,
  yearTo?: number | null
): Promise<SearchArticleResult[]> {
  const tokens = normalizeTextTokens(query).filter((t) => /^[a-z0-9-]+$/i.test(t));
  const baseQuery =
    tokens.length > 0
      ? `(${tokens.slice(0, 6).map((t) => `all:${encodeURIComponent(t)}`).join('+AND+')})`
      : `all:${encodeURIComponent(query)}`;

  const dateFilter =
    yearFrom || yearTo
      ? `+AND+submittedDate:[${yearFrom ?? 1991}01010000+TO+${yearTo ?? new Date().getFullYear() + 1}12312359]`
      : '';

  const url = `https://export.arxiv.org/api/query?search_query=${baseQuery}${dateFilter}&start=0&max_results=10`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const results: SearchArticleResult[] = [];

  $('entry').each((_, el) => {
    const idUrl = $(el).find('id').first().text().trim();
    const title = $(el).find('title').first().text().replace(/\s+/g, ' ').trim();
    const published = $(el).find('published').first().text().trim();
    const summary = $(el).find('summary').first().text().replace(/\s+/g, ' ').trim();
    const authors: string[] = [];
    $(el)
      .find('author > name')
      .each((__, a) => {
        const name = $(a).text().trim();
        if (name) authors.push(name);
      });

    if (!title || !idUrl) return;
    const arxMatch = idUrl.match(/arxiv\.org\/abs\/([^\s?#]+)/i);
    const arxId = arxMatch ? arxMatch[1].replace(/v\d+$/i, '') : null;
    const doi = arxId ? `10.48550/arXiv.${arxId}` : null;
    const pdfUrl = arxId ? `https://arxiv.org/pdf/${arxId}.pdf` : null;

    results.push({
      id: `arxiv-${arxId ?? idUrl}`,
      title,
      authors: authors.slice(0, 5),
      publishedDate: published ? published.slice(0, 10) : null,
      year: published ? published.slice(0, 4) : null,
      articleUrl: idUrl,
      doi,
      sourceEngine: 'arXiv',
      venue: 'arXiv Preprint',
      citedByCount: null,
      abstract: summary || null,
      openAccessPdfUrl: pdfUrl,
      pdfCandidates: pdfUrl ? [pdfUrl] : [],
      similarityScore: computeTitleSimilarity(query, title),
    });
  });

  return results;
}

async function searchDoaj(
  query: string,
  yearFrom?: number | null,
  yearTo?: number | null
): Promise<SearchArticleResult[]> {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=12`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AcademicArticleExplorer/1.0' },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.results) ? data.results : [];

  return list
    .filter((item: { bibjson?: { title?: string; year?: string } }) => {
      if (!item?.bibjson?.title) return false;
      if (yearFrom || yearTo) {
        const y = Number(item.bibjson.year);
        if (!y || Number.isNaN(y)) return false;
        if (yearFrom && y < yearFrom) return false;
        if (yearTo && y > yearTo) return false;
      }
      return true;
    })
    .map((item: {
      id?: string;
      bibjson: {
        title: string;
        year?: string;
        abstract?: string;
        author?: Array<{ name?: string }>;
        journal?: { title?: string };
        identifier?: Array<{ type?: string; id?: string }>;
        link?: Array<{ type?: string; url?: string; content_type?: string }>;
      };
    }) => {
      const b = item.bibjson;
      const doiId = Array.isArray(b.identifier)
        ? b.identifier.find((x) => x.type?.toLowerCase() === 'doi')?.id ?? null
        : null;
      const doi = doiId ? cleanDoi(doiId) : null;
      const fulltextLinks = Array.isArray(b.link)
        ? b.link
            .filter((l) => typeof l.url === 'string' && l.url.startsWith('http'))
            .map((l) => l.url!)
        : [];
      const pdfLinks = fulltextLinks.filter((u) => u.toLowerCase().includes('.pdf'));
      const fulltextLink = fulltextLinks[0] ?? null;
      const title = String(b.title).replace(/<[^>]+>/g, '').trim();

      return {
        id: `doaj-${doi ?? item.id ?? title}`,
        title,
        authors: Array.isArray(b.author) ? b.author.slice(0, 5).map((a) => a.name ?? '').filter(Boolean) : [],
        publishedDate: b.year ? String(b.year) : null,
        year: b.year ? String(b.year) : null,
        articleUrl: fulltextLink ?? (doi ? `https://doi.org/${doi}` : `https://doaj.org/article/${item.id ?? ''}`),
        doi,
        sourceEngine: 'DOAJ',
        venue: b.journal?.title ? String(b.journal.title) : null,
        citedByCount: null,
        abstract: b.abstract ? String(b.abstract).trim() : null,
        openAccessPdfUrl: pdfLinks[0] ?? null,
        pdfCandidates: pdfLinks,
        similarityScore: computeTitleSimilarity(query, title),
      } satisfies SearchArticleResult;
    });
}

async function searchAllAcademicEngines(
  query: string,
  yearFrom?: number | null,
  yearTo?: number | null
): Promise<ArticleSearchResponse> {
  const engines = [
    { name: 'OpenAlex', fn: () => searchOpenAlex(query, yearFrom, yearTo) },
    { name: 'Crossref', fn: () => searchCrossref(query, yearFrom, yearTo) },
    { name: 'Europe PMC', fn: () => searchEuropePmc(query, yearFrom, yearTo) },
    { name: 'arXiv', fn: () => searchArxiv(query, yearFrom, yearTo) },
    { name: 'DOAJ', fn: () => searchDoaj(query, yearFrom, yearTo) },
  ];

  const settled = await Promise.allSettled(engines.map((e) => e.fn()));
  const enginesSearched: string[] = [];
  const merged = new Map<string, SearchArticleResult>();

  settled.forEach((outcome, idx) => {
    const engineName = engines[idx].name;
    if (outcome.status === 'fulfilled' && outcome.value.length > 0) {
      enginesSearched.push(engineName);
      for (const item of outcome.value) {
        if (!item.articleUrl) continue;

        // Enforce strict year bounds if user specified a year range
        if (yearFrom || yearTo) {
          const itemYear = item.year ? Number(item.year) : Number((item.publishedDate ?? '').slice(0, 4));
          if (!itemYear || Number.isNaN(itemYear)) continue;
          if (yearFrom && itemYear < yearFrom) continue;
          if (yearTo && itemYear > yearTo) continue;
        }

        const normTitle = normalizeArabicChars(item.title.toLowerCase())
          .replace(/[^a-z0-9\u0600-\u06FF]+/g, '')
          .slice(0, 80);
        const dedupKey = item.doi ? `doi:${item.doi.toLowerCase()}` : `title:${normTitle}`;

        const existing = merged.get(dedupKey);
        if (!existing) {
          merged.set(dedupKey, item);
        } else {
          const sources = existing.sourceEngine.includes(item.sourceEngine)
            ? existing.sourceEngine
            : `${existing.sourceEngine} / ${item.sourceEngine}`;
          const mergedPdfCandidates = Array.from(
            new Set([
              ...(existing.pdfCandidates ?? []),
              ...(item.pdfCandidates ?? []),
              ...(existing.openAccessPdfUrl ? [existing.openAccessPdfUrl] : []),
              ...(item.openAccessPdfUrl ? [item.openAccessPdfUrl] : []),
            ])
          );
          merged.set(dedupKey, {
            ...existing,
            sourceEngine: sources,
            doi: existing.doi ?? item.doi,
            publishedDate:
              (existing.publishedDate?.length ?? 0) >= (item.publishedDate?.length ?? 0)
                ? existing.publishedDate
                : item.publishedDate,
            year: existing.year ?? item.year,
            venue: existing.venue ?? item.venue,
            authors: existing.authors.length >= item.authors.length ? existing.authors : item.authors,
            citedByCount:
              existing.citedByCount !== null && item.citedByCount !== null
                ? Math.max(existing.citedByCount, item.citedByCount)
                : existing.citedByCount ?? item.citedByCount,
            abstract: existing.abstract ?? item.abstract,
            openAccessPdfUrl: existing.openAccessPdfUrl ?? item.openAccessPdfUrl ?? mergedPdfCandidates[0] ?? null,
            pdfCandidates: mergedPdfCandidates,
            similarityScore: Math.max(existing.similarityScore, item.similarityScore),
          });
        }
      }
    }
  });

  const allValues = Array.from(merged.values());
  const relevant = allValues.filter((a) => a.similarityScore >= 22);
  const pool = relevant.length >= 4 ? relevant : allValues;

  const sorted = pool
    .sort((a, b) => {
      const scoreDiff = b.similarityScore - a.similarityScore;
      if (Math.abs(scoreDiff) >= 6) return scoreDiff;
      return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
    })
    .slice(0, 30);

  return {
    success: true,
    query,
    yearFrom: yearFrom ?? null,
    yearTo: yearTo ?? null,
    enginesSearched: enginesSearched.length > 0 ? enginesSearched : engines.map((e) => e.name),
    totalResults: sorted.length,
    articles: sorted,
  };
}

function parseOptionalYear(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(n) || n < 1900 || n > maxYear) return null;
  return n;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.post('/api/search', async (req, res) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    let yearFrom = parseOptionalYear(req.body?.yearFrom);
    let yearTo = parseOptionalYear(req.body?.yearTo);
    if (yearFrom && yearTo && yearFrom > yearTo) {
      [yearFrom, yearTo] = [yearTo, yearFrom];
    }

    if (!query || query.length > 500) {
      res.status(400).json({
        success: false,
        query,
        yearFrom,
        yearTo,
        enginesSearched: [],
        totalResults: 0,
        articles: [],
        error: 'يرجى إدخال عنوان البحث أو كلمات مفتاحية صالحة.',
      } satisfies ArticleSearchResponse);
      return;
    }

    try {
      const result = await searchAllAcademicEngines(query, yearFrom, yearTo);
      res.json(result);
    } catch {
      res.status(500).json({
        success: false,
        query,
        yearFrom,
        yearTo,
        enginesSearched: [],
        totalResults: 0,
        articles: [],
        error: 'تعذّر البحث في محركات المقالات العلمية حالياً. يرجى المحاولة مرة أخرى.',
      } satisfies ArticleSearchResponse);
    }
  });

  app.post('/api/article-pdf', async (req, res) => {
    const rawDoi = typeof req.body?.doi === 'string' ? req.body.doi.trim() : '';
    const rawUrl = typeof req.body?.articleUrl === 'string' ? req.body.articleUrl.trim() : '';
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const rawOaPdf = typeof req.body?.openAccessPdfUrl === 'string' ? req.body.openAccessPdfUrl.trim() : '';
    const rawCandidates = Array.isArray(req.body?.pdfCandidates)
      ? req.body.pdfCandidates.filter((c: unknown): c is string => typeof c === 'string' && c.startsWith('http'))
      : [];

    let doi = rawDoi ? cleanDoi(rawDoi) : null;

    if (!doi && rawUrl) {
      try {
        const resolved = await resolveDoiFromUrl(rawUrl);
        if (resolved.doi) doi = resolved.doi;
      } catch {
        // ignore
      }
    }

    if (!doi && rawTitle && rawTitle.length > 8) {
      try {
        const cr = await fetch(
          `https://api.crossref.org/works?query.title=${encodeURIComponent(rawTitle)}&rows=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (cr.ok) {
          const data = await cr.json();
          const item = data?.message?.items?.[0];
          if (item?.DOI) doi = cleanDoi(String(item.DOI));
        }
      } catch {
        // ignore
      }
    }

    // Step 1: Collect direct PDF download links FROM THE ARTICLE ITSELF (before Sci-Hub)
    const directCandidatesSet = new Set<string>();
    const addDirect = (u: string | null | undefined) => {
      if (u && (u.startsWith('http://') || u.startsWith('https://')) && !u.includes('sci-hub')) {
        directCandidatesSet.add(u.trim());
      }
    };

    addDirect(rawOaPdf);
    for (const c of rawCandidates) addDirect(c);
    if (doi && /^10\.48550\/arXiv\./i.test(doi)) {
      const arxId = doi.replace(/^10\.48550\/arXiv\./i, '');
      addDirect(`https://arxiv.org/pdf/${arxId}.pdf`);
    }

    const [unpaywallUrls, pagePdfUrls] = await Promise.all([
      doi ? fetchUnpaywallPdfCandidates(doi) : Promise.resolve([]),
      rawUrl ? extractDirectPdfFromArticlePage(rawUrl) : Promise.resolve([]),
    ]);

    for (const u of pagePdfUrls) addDirect(u);
    for (const u of unpaywallUrls) addDirect(u);

    const directCandidates = Array.from(directCandidatesSet).slice(0, 8);
    const sciHubBoxUrl = doi ? `https://sci-hub.box/${encodeURI(doi)}` : null;

    // Verify direct article PDF candidates first
    for (const candidate of directCandidates) {
      if (await verifyPdfStream(candidate, rawUrl || undefined)) {
        res.json({
          available: true,
          isPaidRestricted: false,
          requiresManualSciHubCheck: false,
          doi,
          pdfUrl: candidate,
          pdfCandidates: directCandidates,
          sciHubBoxUrl,
          source: 'article-direct',
          fileSize: null,
          sha256: null,
          md5: null,
          message: 'تم استخراج رابط تحميل PDF المباشر من المقالة وبدأ التحميل مباشرة.',
        } satisfies ArticlePdfCheckResponse);
        return;
      }
    }

    // Step 2: Fallback to Sci-Hub (marked for manual inspection / verification)
    if (doi) {
      const { record } = await searchSciHub(doi, null);
      const sciCandidates = record.pdfCandidates ?? (record.pdfUrl ? [record.pdfUrl] : []);

      for (const candidate of sciCandidates) {
        if (await verifyPdfStream(candidate)) {
          res.json({
            available: true,
            isPaidRestricted: false,
            requiresManualSciHubCheck: true,
            doi,
            pdfUrl: candidate,
            pdfCandidates: sciCandidates,
            sciHubBoxUrl,
            source: 'sci-hub',
            fileSize: record.fileSize,
            sha256: record.sha256,
            md5: record.md5,
            message:
              'تم جلب الملف من موقع Sci-Hub — يمكنك تحميله مباشرة أو فحصه يدوياً عبر المعاينة وبصمة التحقق.',
          } satisfies ArticlePdfCheckResponse);
          return;
        }
      }
    }

    res.json({
      available: false,
      isPaidRestricted: true,
      requiresManualSciHubCheck: Boolean(doi),
      doi,
      pdfUrl: null,
      pdfCandidates: [],
      sciHubBoxUrl,
      source: 'none',
      fileSize: null,
      sha256: null,
      md5: null,
      message: 'هذه المقالة غير موجودة على موقع Sci-Hub بصيغة PDF — المقالة مدفوعة وغير مجانية ولا يمكن تحميلها.',
    } satisfies ArticlePdfCheckResponse);
  });

  app.post('/api/lookup', async (req, res) => {
    const rawInput = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
    if (!rawInput || rawInput.length > 2048) {
      res.status(400).json({
        success: false,
        input: rawInput,
        doi: null,
        doiSource: null,
        articleUrl: null,
        metadata: {
          title: null,
          authors: [],
          journal: null,
          year: null,
          publisher: null,
          abstract: null,
          citation: null,
        },
        sciHub: null,
        error: 'يرجى إدخال رابط مقالة أو معرّف DOI صالح.',
      } satisfies LookupResponse);
      return;
    }

    try {
      const resolved = await resolveDoiFromUrl(rawInput);
      if (!resolved.doi) {
        res.json({
          success: false,
          input: rawInput,
          doi: null,
          doiSource: null,
          articleUrl: resolved.normalizedUrl,
          metadata: {
            title: resolved.pageMetadata.title ?? null,
            authors: resolved.pageMetadata.authors ?? [],
            journal: resolved.pageMetadata.journal ?? null,
            year: resolved.pageMetadata.year ?? null,
            publisher: null,
            abstract: null,
            citation: null,
          },
          sciHub: null,
          error:
            'تعذّر استخراج معرّف DOI تلقائياً من هذا الرابط. قد يحجب الناشر القراءة الآلية، أو أن الصفحة لا تحتوي على DOI. يمكنك لصق معرّف DOI مباشرة في خانة البحث.',
        } satisfies LookupResponse);
        return;
      }

      const [bibResult, sciHubResult] = await Promise.all([
        fetchMetadataFromCrossrefAndOpenAlex(resolved.doi),
        searchSciHub(resolved.doi, null),
      ]);

      // Re-run fallback check if OpenAlex found an OA PDF while Sci-Hub archive returned none
      let finalSciHub = sciHubResult.record;
      if (!finalSciHub.available && bibResult.openAccessPdfUrl) {
        finalSciHub = {
          ...finalSciHub,
          available: true,
          checkedSource: 'open-access',
          pdfUrl: bibResult.openAccessPdfUrl,
          openAccessPdfUrl: bibResult.openAccessPdfUrl,
          message: 'تتوفر نسخة مجانية مفتوحة الوصول (Open Access) بصيغة PDF لهذه المقالة.',
        };
      } else if (finalSciHub.available && !finalSciHub.pdfUrl && bibResult.openAccessPdfUrl) {
        finalSciHub = {
          ...finalSciHub,
          pdfUrl: bibResult.openAccessPdfUrl,
          openAccessPdfUrl: bibResult.openAccessPdfUrl,
        };
      }

      const mergedMetadata: ArticleMetadata = {
        title: bibResult.metadata.title ?? sciHubResult.extraMeta.title ?? resolved.pageMetadata.title ?? null,
        authors:
          bibResult.metadata.authors.length > 0
            ? bibResult.metadata.authors
            : resolved.pageMetadata.authors ?? [],
        journal: bibResult.metadata.journal ?? resolved.pageMetadata.journal ?? null,
        year: bibResult.metadata.year ?? resolved.pageMetadata.year ?? null,
        volume: bibResult.metadata.volume ?? null,
        issue: bibResult.metadata.issue ?? null,
        pages: bibResult.metadata.pages ?? null,
        citedByCount: bibResult.metadata.citedByCount ?? null,
        publisher: bibResult.metadata.publisher ?? null,
        abstract: bibResult.metadata.abstract ?? sciHubResult.extraMeta.abstract ?? null,
        citation: bibResult.metadata.citation ?? sciHubResult.extraMeta.citation ?? null,
      };

      res.json({
        success: true,
        input: rawInput,
        doi: resolved.doi,
        doiSource: resolved.source,
        articleUrl: resolved.normalizedUrl,
        metadata: mergedMetadata,
        sciHub: finalSciHub,
      } satisfies LookupResponse);
    } catch (error) {
      res.status(500).json({
        success: false,
        input: rawInput,
        doi: null,
        doiSource: null,
        articleUrl: null,
        metadata: {
          title: null,
          authors: [],
          journal: null,
          year: null,
          publisher: null,
          abstract: null,
          citation: null,
        },
        sciHub: null,
        error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء معالجة الرابط.',
      } satisfies LookupResponse);
    }
  });

  app.get('/api/download', async (req, res) => {
    const rawPdfUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const rawDoi = typeof req.query.doi === 'string' ? req.query.doi.trim() : 'article';
    const safeFilename = `${rawDoi.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;
    const fallbackBoxUrl = rawDoi && rawDoi !== 'article' ? `https://sci-hub.box/${rawDoi}` : 'https://sci-hub.box/';

    if (!rawPdfUrl) {
      res.status(400).json({ ok: false, fallbackUrl: fallbackBoxUrl, error: 'رابط PDF غير محدد.' });
      return;
    }

    try {
      const { response } = await safeFetch(rawPdfUrl, {
        headers: {
          Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
          Referer: 'https://sci-hub.box/',
        },
        timeoutMs: 15000,
      });

      if (!response.ok) {
        res.status(502).json({
          ok: false,
          fallbackUrl: fallbackBoxUrl,
          directUrl: rawPdfUrl,
          error: 'تعذّر سحب الملف مباشرة عبر الخادم؛ يمكنك التحميل مباشرة من sci-hub.box.',
        });
        return;
      }

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      const maxPdfBytes = 35 * 1024 * 1024;
      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (declaredLength > maxPdfBytes) {
        res.status(502).json({
          ok: false,
          fallbackUrl: fallbackBoxUrl,
          directUrl: rawPdfUrl,
          error: 'حجم الملف يتجاوز الحد المسموح للتحميل المباشر؛ يمكنك فتحه عبر sci-hub.box.',
        });
        return;
      }

      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > maxPdfBytes) {
              await reader.cancel();
              res.status(502).json({
                ok: false,
                fallbackUrl: fallbackBoxUrl,
                directUrl: rawPdfUrl,
                error: 'حجم الملف يتجاوز الحد المسموح للتحميل المباشر؛ يمكنك فتحه عبر sci-hub.box.',
              });
              return;
            }
            chunks.push(value);
          }
        }
      }
      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const isPdfMagic = buffer.subarray(0, 5).toString('ascii') === '%PDF-';

      if (!isPdfMagic && !contentType.includes('application/pdf')) {
        res.status(502).json({
          ok: false,
          fallbackUrl: fallbackBoxUrl,
          directUrl: rawPdfUrl,
          error: 'الخادم المصدر يطلب تحقق متصفح قبل تحميل الملف. استخدم رابط sci-hub.box المباشر.',
        });
        return;
      }

      const isInline = req.query.inline === '1';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `${isInline ? 'inline' : 'attachment'}; filename="${safeFilename}"`
      );
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch {
      res.status(502).json({
        ok: false,
        fallbackUrl: fallbackBoxUrl,
        directUrl: rawPdfUrl,
        error: 'تعذّر الاتصال بمصدر PDF من الخادم. يمكنك فتح الملف عبر sci-hub.box مباشرة.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer();
