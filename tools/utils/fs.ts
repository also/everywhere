export function isErrno(error: unknown): error is NodeJS.ErrnoException {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as any).code === 'string'
    );
  }