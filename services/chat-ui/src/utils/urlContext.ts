const MAX_LOCATION_LENGTH = 120;

function normalizeLocationValue(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_LOCATION_LENGTH) {
    return trimmed.slice(0, MAX_LOCATION_LENGTH);
  }
  return trimmed;
}

/**
 * Resolve customer location context from URL query params.
 * Supported key: location.
 */
export function resolveCustomerLocation(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("location");
  if (!raw) {
    return null;
  }
  return normalizeLocationValue(raw);
}

/**
 * Build sticky conversation state from URL query params.
 */
export function buildStickyConversationState(search: string): Record<string, string> {
  const location = resolveCustomerLocation(search);
  if (!location) {
    return {};
  }
  return {
    location,
  };
}
