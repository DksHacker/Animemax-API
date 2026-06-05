import axios from 'axios';

/**
 * Cloudflare bypass utility with multiple strategies
 * Strategy 1: cloudflare-scraper library (optional)
 * Strategy 2: Fetch with standard headers
 * Strategy 3: Mirror URL fallback
 */

let scraperLib = null;

// Lazy load cloudflare-scraper
async function getScraper() {
  if (scraperLib === null) {
    try {
      const cloudflareScraper = await import('cloudflare-scraper');
      scraperLib = typeof cloudflareScraper === 'function' 
        ? cloudflareScraper() 
        : cloudflareScraper.default?.();
    } catch (err) {
      console.warn('[CF-Bypass] cloudflare-scraper not available, using fallback methods only');
      scraperLib = false; // Mark as unavailable
    }
  }
  return scraperLib || null;
}

/**
 * Get a cloudflare-protected URL with multiple fallback strategies
 * @param {string} url - The URL to fetch
 * @param {Object} options - Request options
 * @param {Array<string>} mirrors - Mirror URLs to try if main fails
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function bypassCloudflare(url, options = {}, mirrors = []) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Referer': url,
    ...options.headers,
  };

  // Strategy 1: Try with cloudflare-scraper
  try {
    const scraper = await getScraper();
    if (scraper && typeof scraper === 'function') {
      console.log(`[CF-Bypass] Attempting cloudflare-scraper for: ${url}`);
      const response = await scraper(url, {
        headers,
        timeout: options.timeout || 30000,
      });
      
      if (response) {
        console.log(`[CF-Bypass] ✓ cloudflare-scraper succeeded for: ${url}`);
        return {
          success: true,
          data: response,
          strategy: 'cloudflare-scraper',
        };
      }
    }
  } catch (err) {
    console.warn(`[CF-Bypass] cloudflare-scraper failed: ${err.message}`);
  }

  // Strategy 2: Try standard fetch with enhanced headers
  try {
    console.log(`[CF-Bypass] Attempting standard fetch for: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.text();
    console.log(`[CF-Bypass] ✓ Standard fetch succeeded for: ${url}`);
    return {
      success: true,
      data,
      strategy: 'standard-fetch',
    };
  } catch (err) {
    console.warn(`[CF-Bypass] Standard fetch failed: ${err.message}`);
  }

  // Strategy 3: Try mirror URLs
  if (mirrors && mirrors.length > 0) {
    for (const mirror of mirrors) {
      try {
        console.log(`[CF-Bypass] Attempting mirror: ${mirror}`);
        const mirrorUrl = url.replace(new URL(url).hostname, new URL(mirror).hostname);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

        const response = await fetch(mirrorUrl, {
          headers: {
            ...headers,
            'Referer': mirror,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.text();
        console.log(`[CF-Bypass] ✓ Mirror succeeded: ${mirror}`);
        return {
          success: true,
          data,
          strategy: 'mirror',
          mirror,
        };
      } catch (err) {
        console.warn(`[CF-Bypass] Mirror ${mirror} failed: ${err.message}`);
      }
    }
  }

  return {
    success: false,
    error: 'All bypass strategies failed',
    strategies_tried: ['cloudflare-scraper', 'standard-fetch', 'mirrors'],
  };
}

/**
 * Make an axios request with Cloudflare bypass and retry logic
 * @param {string} url - The URL to fetch
 * @param {Object} options - Axios options
 * @param {Array<string>} mirrors - Mirror URLs
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function axiosWithBypass(url, options = {}, mirrors = [], maxRetries = 2) {
  let lastError = null;

  // Try direct axios first (for non-CF protected endpoints)
  for (let i = 0; i <= maxRetries; i++) {
    try {
      console.log(`[CF-BypassAxios] Attempt ${i + 1}/${maxRetries + 1} for: ${url}`);
      const response = await axios.get(url, {
        timeout: options.timeout || 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.headers,
        },
        ...options,
      });

      console.log(`[CF-BypassAxios] ✓ Direct axios succeeded`);
      return {
        success: true,
        data: response,
        strategy: 'axios-direct',
      };
    } catch (error) {
      lastError = error;
      console.warn(`[CF-BypassAxios] Direct axios attempt ${i + 1} failed: ${error.message}`);
      
      // If Cloudflare error, break and try bypass
      if (error.status === 403 || error.response?.status === 403) {
        console.log(`[CF-BypassAxios] Cloudflare protection detected, switching to bypass`);
        break;
      }
    }
  }

  // If direct axios fails, try bypass strategies
  console.log(`[CF-BypassAxios] Attempting bypass strategies`);
  const bypassResult = await bypassCloudflare(url, options, mirrors);
  
  if (bypassResult.success) {
    // Try to parse as JSON if possible
    try {
      return {
        success: true,
        data: { data: JSON.parse(bypassResult.data) },
        strategy: bypassResult.strategy,
      };
    } catch {
      return {
        success: true,
        data: { data: bypassResult.data },
        strategy: bypassResult.strategy,
      };
    }
  }

  return {
    success: false,
    error: lastError?.message || 'All strategies failed',
  };
}

export default {
  bypassCloudflare,
  axiosWithBypass,
};
