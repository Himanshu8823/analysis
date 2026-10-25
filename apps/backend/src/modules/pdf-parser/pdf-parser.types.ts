export interface PdfPageText {
  pageNumber: number;
  text: string;
  tables: string[][][];
}

export interface PdfParseResult {
  pages: PdfPageText[];
  metadata: {
    totalPages: number;
    extractedAt: string;
  };
}
