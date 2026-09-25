/**
 * A small memory of answers to paid lookups, so the same question is not paid for twice.
 *
 *  - An answer is kept for `ttlMs`, then forgotten. The store has a fixed size and drops the oldest
 *    entry when full, so it can never grow without limit.
 *  - Only answers that found something are kept. A lookup that failed or came back empty is asked
 *    again next time (`keep` decides what counts as an answer).
 *  - If the same question is asked again while the first is still being answered, both share the
 *    one paid call. Several people scanning the same item at once cost one lookup, not several.
 *  - Answers are looked up from memory in a fraction of a millisecond, so this makes scans
 *    faster, not slower.
 *
 * It holds item names and prices only: never photos, and never anything about who asked.
 */
export class SourceCache<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();
  private readonly inFlight = new Map<string, Promise<T>>();
  hits = 0;
  misses = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly keep: (value: T) => boolean = (v) => v != null
  ) {}

  /** The kept answer for `key`, or the result of `work` (which is then kept if it found something). */
  async get(key: string, work: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && Date.now() - hit.at <= this.ttlMs) {
      this.hits++;
      return hit.value;
    }
    if (hit) this.entries.delete(key);

    const running = this.inFlight.get(key);
    if (running) {
      this.hits++;
      return running;
    }

    this.misses++;
    const promise = work()
      .then((value) => {
        if (this.keep(value)) this.remember(key, value);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private remember(key: string, value: T) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { at: Date.now(), value });
  }

  clear() {
    this.entries.clear();
    this.inFlight.clear();
  }
}
