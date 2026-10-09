const SENSITIVE_KEY = /password|token|secret/i;

/** Copie profonde où toute valeur dont la clé évoque un secret est remplacée (prudence côté UI). */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[tronqué]';
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[masqué]' : redactSensitive(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** JSON texte indenté (échappé par React à l'affichage), clés sensibles masquées. */
export function auditJson(value: unknown): string {
  return JSON.stringify(redactSensitive(value), null, 2) ?? 'null';
}
