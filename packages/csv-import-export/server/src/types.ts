export type PublicationStatus = 'draft' | 'published';

export interface FieldDescription {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  enum?: string[];
  /** media fields only */
  multiple?: boolean;
  relation?: { target: string; multiple: boolean };
}

export interface RelationSetting {
  matchOn: string;
}

export interface ImportRequest {
  locale?: string;
  status: PublicationStatus;
  matchField: string;
  /** CSV column name -> field name */
  mapping: Record<string, string>;
  /** relation field name -> how to find the target */
  relations: Record<string, RelationSetting>;
  onMissingRelation: 'skip' | 'fail';
  dryRun: boolean;
  jobId?: number;
  /** number of data rows sent in earlier batches; row numbers in results are rowOffset + index + 1 */
  rowOffset: number;
  rows: Record<string, string>[];
}

export type RowAction = 'created' | 'updated' | 'skipped' | 'error';

export interface RowResult {
  row: number;
  action: RowAction;
  documentId?: string;
  error?: string;
}

export interface ImportResult {
  aborted: boolean;
  results: RowResult[];
}

export interface ExportColumn {
  field: string;
  header: string;
  /** relation fields: target field written to the cell; defaults to documentId */
  matchOn?: string;
}

export interface ExportRequest {
  locale?: string;
  status: PublicationStatus;
  columns: ExportColumn[];
}
