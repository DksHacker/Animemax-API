import axios from 'axios';
import config from '../config/config.js';
import { RETRY_CONFIG } from '../config/mirrors.config.js';
import { bypassCloudflare } from '../utils/cloudflareBypass.js';

const cookieJar = new Map();

const getHostname = (url) => new URL(url, config.baseurl).hostname;

const buildCookieHeader = (url) => {
  const host = getHostname(url);
  const cookies = cookieJar.get(host);
  if (!cookies) return undefined;
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
};

const storeCookies = (url, setCookie) => {
  if (!setCookie) return;
  const host = getHostname(url);
  const existing = cookieJar.get(host) || {};
  const cookieHeaders = Array.isArray(setCookie) ? setCookie : [setCookie];

  cookieHeaders.forEach((cookieString) => {
    const cookiePart = cookieString.split(';')[0];
    const [name, ...valueParts] = cookiePart.split('=');
    const value = valueParts.join('=');
    if (!name) return;
    existing[name.trim()] = value.trim();
  });

  cookieJar.set(host, existing);
};

const normalizeUrl = (endpoint) => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `${config.baseurl}${endpoint}`;
};

const loadRefererPage = async (referer) => {
  if (!referer) return;
  const refererUrl = referer.startsWith('http') ? referer : `${config.baseurl}${referer}`;
  try {
    console.log(`[axiosInstance] Preflight referer: ${refererUrl}`);
    const response = await axios.get(refererUrl, {
      headers: {
        ...(config.headers || {}),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': refererUrl,
      },
      timeout: RETRY_CONFIG.timeout,
    });
    storeCookies(refererUrl, response.headers['set-cookie']);
    console.log('[axiosInstance] Preflight referer loaded');
  } catch (err) {
    console.warn(`[axiosInstance] Preflight failed: ${err.message}`);
  }
};

const makeAxiosRequest = async (url, headers) => {
  const cookieHeader = buildCookieHeader(url);
  const requestHeaders = {
    ...headers,
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  const response = await axios.get(url, {
    headers: requestHeaders,
    timeout: RETRY_CONFIG.timeout,
  });

  storeCookies(url, response.headers['set-cookie']);
  return response;
};

/**
 * Enhanced axios instance with Cloudflare bypass and fallback mechanisms
 * Uses axios with an in-memory cookie jar and referer preflight for AJAX endpoints
 */
export const axiosInstance = async (endpoint, options = {}) => {
  const fullUrl = normalizeUrl(endpoint);
  const customHeaders = {
    ...(config.headers || {}),
    ...options.headers,
  };

  try {
    console.log(`[axiosInstance] Requesting: ${fullUrl}`);
    let response = await makeAxiosRequest(fullUrl, customHeaders);

    if (
      response?.data &&
      typeof response.data === 'object' &&
      response.data.status === false &&
      response.data.msg?.toLowerCase().includes('something went wrong') &&
      options.headers?.Referer
    ) {
      console.log('[axiosInstance] Server returned failure, retrying with referer preflight');
      await loadRefererPage(options.headers.Referer);
      response = await makeAxiosRequest(fullUrl, customHeaders);

      // If still failing after referer preflight, try bypass
      if (
        response?.data &&
        typeof response.data === 'object' &&
        response.data.status === false
      ) {
        console.log(`[axiosInstance] Still failing after referer preflight, trying bypass for: ${fullUrl}`);
        try {
          const bypassResult = await bypassCloudflare(fullUrl, {
            headers: customHeaders,
            timeout: RETRY_CONFIG.timeout,
          }, []);

          if (bypassResult.success) {
            console.log(`[axiosInstance] ✓ Bypass succeeded for: ${fullUrl}`);
            return {
              success: true,
              data: bypassResult.data,
              status: 200,
              method: 'bypass',
            };
          }
        } catch (bypassError) {
          console.warn(`[axiosInstance] Bypass error: ${bypassError.message}`);
        }
      }
    }

    console.log(`[axiosInstance] ✓ Request succeeded, status: ${response.status}`);
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error(`[axiosInstance] Request failed:`, error.message);
    if (error.response?.status) {
      console.error(`[axiosInstance] Response status: ${error.response.status}`);
      console.error(`[axiosInstance] Response data:`, error.response.data);
    }

    // Try Cloudflare bypass for 403 errors or other failures
    if (error.response?.status === 403 || error.response?.status === 429 || !error.response) {
      console.log(`[axiosInstance] Attempting Cloudflare bypass for: ${fullUrl}`);
      try {
        const bypassResult = await bypassCloudflare(fullUrl, {
          headers: customHeaders,
          timeout: RETRY_CONFIG.timeout,
        }, []); // Empty mirrors array for now

        if (bypassResult.success) {
          console.log(`[axiosInstance] ✓ Bypass succeeded for: ${fullUrl}`);
          return {
            success: true,
            data: bypassResult.data,
            status: 200,
            method: 'bypass',
          };
        } else {
          console.warn(`[axiosInstance] Bypass failed for: ${fullUrl}`);
        }
      } catch (bypassError) {
        console.warn(`[axiosInstance] Bypass error: ${bypassError.message}`);
      }
    }

    return {
      success: false,
      message: error.message || 'Request failed',
      status: error.response?.status,
      data: error.response?.data,
    };
  }
};
