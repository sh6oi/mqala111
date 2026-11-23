export interface ArticleMetadata {
  title: string | null;
  authors: string[];
  journal: string | null;
  year: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  citedByCount?: number | null;
  publisher: string | null;
  abstract: string | null;
  citation: string | null;
}

export interface SciHubRecord {
  available: boolean;
  checkedSource: 'sci-hub.box' | 'sci-hub-archive' | 'open-access' | 'none';
  sciHubBoxUrl: string;
  sciHubBoxChallengeDetected: boolean;
  pdfUrl: string | null;
  openAccessPdfUrl: string | null;
  fileSize: string | null;
  sha256: string | null;
  md5: string | null;
  message: string;
}

export interface LookupResponse {
  success: boolean;
  input: string;
  doi: string | null;
  doiSource: string | null;
  articleUrl: string | null;
  metadata: ArticleMetadata;
  sciHub: SciHubRecord | null;
  error?: string;
}

export interface HistoryItem {
  id: string;
  input: string;
  doi: string;
  title: string | null;
  journal: string | null;
  year: string | null;
  available: boolean;
  pdfUrl: string | null;
  sciHubBoxUrl: string;
  checkedAt: string;
  bookmarked?: boolean;
}

export interface BatchItemResult {
  input: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  data?: LookupResponse;
}
