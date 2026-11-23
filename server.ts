import 'dotenv/config';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import * as cheerio from 'cheerio';
import type { ArticleMetadata, LookupResponse, SciHubRecord } from './src/types.ts';

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

async function searchSciHub(doi: string, openAccessFallback: string | null): Promise<{
  record: SciHubRecord;
  extraMeta: Partial<ArticleMetadata>;
}> {
  const sciHubBoxBase = 'https://sci-hub.box';
  const sciHubBoxUrl = `${sciHubBoxBase}/${doi}`;
  const extraMeta: Partial<ArticleMetadata> = {};
  let challengeDetected = false;

  // 1. Primary search on https://sci-hub.box/
  try {
    const { response } = await safeFetch(`${sciHubBoxBase}/${encodeURI(doi)}`, { timeoutMs: 8000 });
    const html = await readTextLimited(response);
    if (html.includes('DDoS-Guard') || response.status === 403) {
      challengeDetected = true;
    } else if (response.ok && html.length > 500) {
      const parsed = parseSciHubPage(html, sciHubBoxBase, doi);
      if (parsed.title) extraMeta.title = parsed.title;
      if (parsed.abstract) extraMeta.abstract = parsed.abstract;
      if (parsed.citation) extraMeta.citation = parsed.citation;

      if (parsed.found) {
        return {
          record: {
            available: true,
            checkedSource: 'sci-hub.box',
            sciHubBoxUrl,
            sciHubBoxChallengeDetected: false,
            pdfUrl: parsed.pdfUrl ?? openAccessFallback,
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

  // 2. Fallback check across official Sci-Hub mirrors when sci-hub.box enforces DDoS-Guard JS check
  const mirrors = ['https://sci-hub.ru', 'https://sci-hub.st', 'https://sci-hub.ren'];
  let foundInArchive = false;
  let archivePdfUrl: string | null = null;
  let archiveOpenAccess: string | null = null;
  let archiveSize: string | null = null;
  let archiveSha256: string | null = null;
  let archiveMd5: string | null = null;

  for (const mirror of mirrors) {
    try {
      const { response } = await safeFetch(`${mirror}/${encodeURI(doi)}`, { timeoutMs: 7000 });
      // Self-redirect loop (302) means DOI is not in Sci-Hub index
      if (response.status >= 300 && response.status < 400) {
        continue;
      }
      if (!response.ok) continue;
      const html = await readTextLimited(response);
      if (html.includes('DDoS-Guard') || html.includes('challenges.cloudflare.com')) {
        continue;
      }

      const parsed = parseSciHubPage(html, mirror, doi);
      if (parsed.title && !extraMeta.title) extraMeta.title = parsed.title;
      if (parsed.abstract && !extraMeta.abstract) extraMeta.abstract = parsed.abstract;
      if (parsed.citation && !extraMeta.citation) extraMeta.citation = parsed.citation;

      if (parsed.found) {
        foundInArchive = true;
        if (parsed.pdfUrl && !archivePdfUrl) archivePdfUrl = parsed.pdfUrl;
        if (parsed.openAccessPdfUrl && !archiveOpenAccess) archiveOpenAccess = parsed.openAccessPdfUrl;
        if (parsed.fileSize && !archiveSize) archiveSize = parsed.fileSize;
        if (parsed.sha256 && !archiveSha256) archiveSha256 = parsed.sha256;
        if (parsed.md5 && !archiveMd5) archiveMd5 = parsed.md5;

        // If we already got a direct .pdf URL (e.g., from sci-hub.ren embed), we can stop early
        if (archivePdfUrl && archivePdfUrl.toLowerCase().includes('.pdf')) {
          break;
        }
      }
    } catch {
      // try next mirror
    }
  }

  const bestPdf = archivePdfUrl ?? archiveOpenAccess ?? openAccessFallback;

  if (foundInArchive) {
    return {
      record: {
        available: true,
        checkedSource: 'sci-hub-archive',
        sciHubBoxUrl,
        sciHubBoxChallengeDetected: challengeDetected,
        pdfUrl: bestPdf,
        openAccessPdfUrl: archiveOpenAccess ?? openAccessFallback,
        fileSize: archiveSize,
        sha256: archiveSha256,
        md5: archiveMd5,
        message: 'المقالة متوفرة ومفهرسة في أرشيف Sci-Hub. يمكنك تحميل ملف PDF أو فتحها عبر sci-hub.box.',
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
        openAccessPdfUrl: openAccessFallback,
        fileSize: null,
        sha256: null,
        md5: null,
        message: 'لم تُفهرس المقالة في Sci-Hub ولكن تتوفر نسخة مجانية مفتوحة الوصول (Open Access) بصيغة PDF.',
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
      openAccessPdfUrl: null,
      fileSize: null,
      sha256: null,
      md5: null,
      message: challengeDetected
        ? 'يفرض موقع sci-hub.box تحقق متصفح (DDoS-Guard) حالياً، ولم يُعثر على نسخة مفهرسة في المرآة الاحتياطية. يمكنك التحقق يدوياً عبر فتح رابط sci-hub.box.'
        : 'المقالة غير متوفرة حالياً في قاعدة بيانات sci-hub.box.',
    },
    extraMeta,
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

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
