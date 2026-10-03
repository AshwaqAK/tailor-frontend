export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiErrorBody {
  readonly success: false;
  readonly message: string | readonly string[];
}

export interface PageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly meta: PageMeta;
}
