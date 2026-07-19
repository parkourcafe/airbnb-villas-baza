/**
 * Lazy singleton helper. Service and database SDKs must be initialized lazily
 * (never at module scope) so that importing this package has no side effects and
 * secrets are only read when a client is actually needed.
 */
export function createLazySingleton<T>(factory: () => T): () => T {
  let instance: T | undefined;
  return () => {
    if (instance === undefined) {
      instance = factory();
    }
    return instance;
  };
}
