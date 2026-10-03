export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
