const POLICY = {
  message: { capacity: 30, perSecond: 1 },
  reaction: { capacity: 30, perSecond: 2 },
  typing: { capacity: 12, perSecond: 4 },
};

// These bounds protect one API process. Use a shared limiter when scaling out.
export function createChatMutationLimiter({ now = Date.now, maxKeys = 10000 } = {}) {
  const buckets = new Map();
  let lastSweep = 0;
  return function consume(companyId, membershipId, action) {
    const policy = POLICY[action];
    if (!policy || !companyId || !membershipId) throw new Error('Company access is required');
    const time = now();
    if (time - lastSweep >= 60000 || buckets.size >= maxKeys) {
      for (const [key, bucket] of buckets)
        if (time - bucket.at >= 60000) buckets.delete(key);
      lastSweep = time;
    }
    const key = JSON.stringify([companyId, membershipId, action]);
    if (!buckets.has(key) && buckets.size >= maxKeys) throw new Error('Chat rate limit exceeded');
    const bucket = buckets.get(key) || { tokens: policy.capacity, at: time };
    bucket.tokens = Math.min(policy.capacity,
      bucket.tokens + Math.max(0, time - bucket.at) * policy.perSecond / 1000);
    bucket.at = time;
    buckets.set(key, bucket);
    if (bucket.tokens < 1) throw new Error('Chat rate limit exceeded');
    bucket.tokens -= 1;
  };
}

export const consumeChatMutation = createChatMutationLimiter();
