export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: readonly string[] = [],
    readonly path?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
