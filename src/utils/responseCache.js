class ResponseCache {
  constructor({ enabled = true, defaultTtlMs = 30000 } = {}) {
    this.enabled = enabled;
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  get(key) {
    if (!this.enabled) {
      return null;
    }

    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (!this.enabled) {
      return;
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  del(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

module.exports = ResponseCache;
