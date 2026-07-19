import type { SourceAdapter } from "./types";

/**
 * A minimal in-memory source registry. Adapters register themselves by key;
 * the worker resolves an adapter by key before checking the compliance gate.
 * The `airbnb` source is intentionally never registered with automation in the
 * MVP - it remains seeded disabled.
 */
export class SourceRegistry {
  private readonly adapters = new Map<string, SourceAdapter>();

  register(adapter: SourceAdapter): void {
    if (this.adapters.has(adapter.definition.key)) {
      throw new Error(
        `source adapter "${adapter.definition.key}" is already registered`,
      );
    }
    this.adapters.set(adapter.definition.key, adapter);
  }

  get(key: string): SourceAdapter | undefined {
    return this.adapters.get(key);
  }

  list(): SourceAdapter[] {
    return [...this.adapters.values()];
  }
}
