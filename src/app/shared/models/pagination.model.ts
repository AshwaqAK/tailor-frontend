export interface CursorPageMeta {
  readonly limit: number;
  readonly hasNextPage: boolean;
  readonly nextCursor: string | null;
}

export interface CursorPage<T> {
  readonly data: readonly T[];
  readonly meta: CursorPageMeta;
}
