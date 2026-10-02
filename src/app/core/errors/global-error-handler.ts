import { Injectable } from '@angular/core';
import type { ErrorHandler } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // Replace this boundary with the production observability provider when selected.
    console.error('Unhandled application error', error);
  }
}
