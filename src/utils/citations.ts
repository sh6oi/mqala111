import type { ArticleMetadata } from '../types.ts';

export type CitationFormat = 'apa' | 'ieee' | 'mla' | 'bibtex';

export function formatCitation(
  doi: string,
  metadata: ArticleMetadata,
  format: CitationFormat
): string {
  const title = metadata.title ?? doi;
  const journal = metadata.journal ?? 'Scientific Publication';
  const year = metadata.year ?? 'n.d.';
  const authors = metadata.authors;
  const volume = metadata.volume;
  const issue = metadata.issue;
  const pages = metadata.pages;

  if (format === 'bibtex') {
    const firstAuthorLast =
      authors[0]?.split(/\s+/).slice(-1)[0]?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'article';
    const citeKey = `${firstAuthorLast}${year !== 'n.d.' ? year : ''}`;
    const authorField = authors.length > 0 ? authors.join(' and ') : 'Unknown';
    const lines = [
      `@article{${citeKey},`,
      `  title = {${title}},`,
      `  author = {${authorField}},`,
      `  journal = {${journal}},`,
      `  year = {${year}},`,
      volume ? `  volume = {${volume}},` : null,
      issue ? `  number = {${issue}},` : null,
      pages ? `  pages = {${pages}},` : null,
      `  doi = {${doi}},`,
      `  url = {https://doi.org/${doi}}`,
      `}`,
    ].filter(Boolean);
    return lines.join('\n');
  }

  if (format === 'ieee') {
    const authorStr =
      authors.length > 0
        ? authors.slice(0, 3).join(', ') + (authors.length > 3 ? ', et al.' : '')
        : 'Anonymous';
    const volIssue = [
      volume ? `vol. ${volume}` : null,
      issue ? `no. ${issue}` : null,
      pages ? `pp. ${pages}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return `${authorStr}, "${title}," ${journal}${volIssue ? `, ${volIssue}` : ''}, ${year}. doi: ${doi}.`;
  }

  if (format === 'mla') {
    const authorStr =
      authors.length > 1
        ? `${authors[0]}, et al.`
        : authors[0] ?? 'Anonymous';
    const volIssue = [
      volume ? `vol. ${volume}` : null,
      issue ? `no. ${issue}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return `${authorStr}. "${title}." ${journal}${volIssue ? `, ${volIssue}` : ''}, ${year}${pages ? `, pp. ${pages}` : ''}. https://doi.org/${doi}.`;
  }

  // APA 7th
  const apaAuthors =
    authors.length > 0
      ? authors.slice(0, 3).join(', ') + (authors.length > 3 ? ', et al.' : '')
      : 'Anonymous';
  const volPart = volume ? `${volume}${issue ? `(${issue})` : ''}` : '';
  const tail = [volPart, pages].filter(Boolean).join(', ');
  return `${apaAuthors} (${year}). ${title}. ${journal}${tail ? `, ${tail}` : ''}. https://doi.org/${doi}`;
}
