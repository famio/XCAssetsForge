/** Insertion-ordered Map used as a small LRU, bounded so caching can't grow unbounded. */
export class LruCache<T> {
  private readonly entries = new Map<string, T>()

  constructor(private readonly limit: number) {}

  get(key: string): T | undefined {
    const value = this.entries.get(key)
    if (value === undefined) return undefined
    // Re-insert so the most recently used entry moves to the end.
    this.entries.delete(key)
    this.entries.set(key, value)
    return value
  }

  set(key: string, value: T) {
    this.entries.delete(key)
    this.entries.set(key, value)
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }

  delete(key: string) {
    this.entries.delete(key)
  }

  keys(): string[] {
    return [...this.entries.keys()]
  }
}
