export class TimeoutError extends Error {
  constructor() {
    super();
    this.name = "TimeoutError";
    this.message = "TimeoutError";
  }
}

export const timeout = (ms: number): Promise<any> => {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new TimeoutError()), ms)
  );
};

export const promiseTimeout = async <T>(
  promise: () => Promise<T>,
  timeoutInMilliseconds: number
): Promise<T> => {
  return await Promise.race([promise(), timeout(timeoutInMilliseconds)]);
};
