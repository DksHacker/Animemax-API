/**
 * Mirror and fallback configuration for various sources
 * Each source has primary URL and list of fallback mirrors
 */

export const MIRROR_CONFIG = {
  // Kaido.to mirrors
  kaido: {
    primary: 'https://kaido.to',
    mirrors: [
      'https://kaido.club',
      'https://kaido.tv',
    ],
    cloudflareProtected: true,
  },

  // Megacloud/Megaplay servers
  megacloud: {
    primary: 'https://megacloud.tv',
    mirrors: [
      'https://megacloud.club',
    ],
    cloudflareProtected: true,
  },

  // Primary streaming fallback
  megaplay: {
    primary: 'https://megaplay.buzz',
    mirrors: [
      'https://vidwish.live',
      'https://vidmoly.to',
    ],
    cloudflareProtected: false,
  },

  // Additional streaming providers
  streaming: {
    megaplay: {
      url: 'https://megaplay.buzz',
      cloudflareProtected: false,
    },
    vidwish: {
      url: 'https://vidwish.live',
      cloudflareProtected: false,
    },
  },
};

/**
 * Retry strategy configuration
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  backoffMultiplier: 1.5,
  timeout: 30000, // 30 seconds
};

/**
 * Headers configuration that helps bypass some protections
 */
export const BYPASS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

/**
 * Get mirrors for a given source
 * @param {string} source - Source name (e.g., 'kaido', 'megacloud')
 * @returns {Array<string>} - Array of URLs to try
 */
export function getMirrorsForSource(source) {
  const config = MIRROR_CONFIG[source];
  if (!config) {
    console.warn(`Unknown mirror source: ${source}`);
    return [];
  }
  return [config.primary, ...(config.mirrors || [])];
}

/**
 * Get all fallback mirrors
 * @returns {Object} - Object with all mirror configurations
 */
export function getAllMirrors() {
  return MIRROR_CONFIG;
}

export default {
  MIRROR_CONFIG,
  RETRY_CONFIG,
  BYPASS_HEADERS,
  getMirrorsForSource,
  getAllMirrors,
};
