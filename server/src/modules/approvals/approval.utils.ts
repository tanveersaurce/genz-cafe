import crypto from 'crypto';

/**
 * Creates a deterministic SHA-256 hash of arbitrary parameters object.
 * Keys are sorted recursively so order does not affect the hash.
 */
export function hashParams(params: unknown): string {
  if (params === undefined || params === null) {
    return crypto.createHash('sha256').update('{}').digest('hex');
  }

  const canonicalJson = serializeDeterministic(params);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

function serializeDeterministic(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(serializeDeterministic).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${serializeDeterministic((obj as Record<string, unknown>)[k])}`
  );
  return '{' + entries.join(',') + '}';
}
