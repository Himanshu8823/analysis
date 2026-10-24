/**
 * Shared API response shapes.
 *
 * The backend's `TransformInterceptor` wraps every payload as
 * `{ success, data, timestamp }`, and list endpoints return
 * `{ items, meta }` inside `data`.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  meta: PaginationMeta;
}
