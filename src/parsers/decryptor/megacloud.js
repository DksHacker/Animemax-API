import axios from 'axios';
import CryptoJS from 'crypto-js';
import config from '../../config/config.js';
import extractToken from '../helper/token.helper.js';
import { bypassCloudflare } from '../../utils/cloudflareBypass.js';
import { BYPASS_HEADERS, RETRY_CONFIG } from '../../config/mirrors.config.js';

const { baseurl } = config;

/**
 * Retry wrapper for promises
 */
async function retryOperation(operation, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[Retry] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
        console.log(`[Retry] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export async function megacloud({ selectedServer, id }) {
  //  selectedServer = {
  //     index: 4,
  //     type: "dub",
  //     id: "668523",
  //     name: "HD-1",
  //   }
  // id  = steinsgate-3::ep=213

  const epID = id.split('ep=').pop();
  const fallback_1 = 'megaplay.buzz';
  const fallback_2 = 'vidwish.live';

  try {
    // Strategy 1: Try to get sources from main megacloud with Cloudflare bypass
    let decryptedSources = null;
    let rawSourceData = {};

    try {
      console.log(`[megacloud] Attempting main sources endpoint: ${baseurl}/ajax/v2/episode/sources?id=${selectedServer.id}`);
      
      const [sourcesResult, keyResult] = await Promise.all([
        retryOperation(
          () => axios.get(`${baseurl}/ajax/v2/episode/sources?id=${selectedServer.id}`, {
            headers: BYPASS_HEADERS,
            timeout: RETRY_CONFIG.timeout,
          }),
          2
        ).catch(async (error) => {
          // If direct axios fails, try bypass
          if (error.status === 403 || error.response?.status === 403) {
            console.log(`[megacloud] Direct axios blocked, trying bypass...`);
            const bypassResult = await bypassCloudflare(
              `${baseurl}/ajax/v2/episode/sources?id=${selectedServer.id}`,
              { headers: BYPASS_HEADERS }
            );
            if (bypassResult.success) {
              return { data: JSON.parse(bypassResult.data) };
            }
          }
          throw error;
        }),
        retryOperation(
          () => axios.get('https://raw.githubusercontent.com/itzzzme/megacloud-keys/refs/heads/main/key.txt'),
          2
        ),
      ]);

      const ajaxLink = sourcesResult?.data?.link;
      if (!ajaxLink) throw new Error('Missing link in sourcesData');

      const sourceIdMatch = /\/([^/?]+)\?/.exec(ajaxLink);
      const sourceId = sourceIdMatch?.[1];
      if (!sourceId) throw new Error('Unable to extract sourceId from link');

      const baseUrlMatch = ajaxLink.match(/^(https?:\/\/[^/]+(?:\/[^/]+){3})/);
      if (!baseUrlMatch) throw new Error('Could not extract base URL from ajaxLink');
      const baseUrl = baseUrlMatch[1];

      try {
        // Try to get token and sources
        console.log(`[megacloud] Extracting token from: ${baseUrl}/${sourceId}`);
        const token = await extractToken(`${baseUrl}/${sourceId}?k=1&autoPlay=0&oa=0&asi=1`);
        
        let rawSourceDataResult;
        try {
          rawSourceDataResult = await axios.get(`${baseUrl}/getSources?id=${sourceId}&_k=${token}`, {
            headers: BYPASS_HEADERS,
            timeout: RETRY_CONFIG.timeout,
          });
        } catch (tokenError) {
          // If getSources fails, try bypass
          if (tokenError.status === 403 || tokenError.response?.status === 403) {
            console.log(`[megacloud] getSources blocked, trying bypass...`);
            const bypassResult = await bypassCloudflare(
              `${baseUrl}/getSources?id=${sourceId}&_k=${token}`,
              { headers: BYPASS_HEADERS }
            );
            if (bypassResult.success) {
              rawSourceDataResult = { data: JSON.parse(bypassResult.data) };
            } else {
              throw tokenError;
            }
          } else {
            throw tokenError;
          }
        }

        rawSourceData = rawSourceDataResult?.data;
        const encrypted = rawSourceData?.sources;
        if (!encrypted) throw new Error('Encrypted source missing');

        const decrypted = CryptoJS.AES.decrypt(encrypted, keyResult?.data?.trim()).toString(CryptoJS.enc.Utf8);
        if (!decrypted) throw new Error('Failed to decrypt source');
        decryptedSources = JSON.parse(decrypted);

        console.log(`[megacloud] ✓ Successfully decrypted sources`);
      } catch (decryptError) {
        console.warn(`[megacloud] Decryption failed: ${decryptError.message}, using fallback...`);
        throw decryptError; // Trigger fallback
      }
    } catch (mainError) {
      console.warn(`[megacloud] Main strategy failed: ${mainError.message}, attempting fallback...`);

      // Strategy 2: Fallback to megaplay/vidwish streaming
      try {
        const fallback = selectedServer.name.toLowerCase() === 'hd-1' ? fallback_1 : fallback_2;
        console.log(`[megacloud] Trying fallback provider: ${fallback}`);

        const { data: html } = await retryOperation(
          () => axios.get(
            `https://${fallback}/stream/s-2/${epID}/${selectedServer.type}`,
            {
              headers: {
                ...BYPASS_HEADERS,
                Referer: `https://${fallback_1}/`,
              },
              timeout: RETRY_CONFIG.timeout,
            }
          ),
          2
        );

        const dataIdMatch = html.match(/data-id=["'](\d+)["']/);
        const realId = dataIdMatch?.[1];
        if (!realId) throw new Error('Could not extract data-id for fallback');

        console.log(`[megacloud] Extracted ID: ${realId}, fetching sources...`);
        
        const fallbackDataResult = await retryOperation(
          () => axios.get(
            `https://${fallback}/stream/getSources?id=${realId}`,
            {
              headers: {
                ...BYPASS_HEADERS,
                'X-Requested-With': 'XMLHttpRequest',
              },
              timeout: RETRY_CONFIG.timeout,
            }
          ),
          2
        );

        const fallback_data = fallbackDataResult?.data;
        decryptedSources = [{ file: fallback_data.sources.file }];
        
        if (!rawSourceData.tracks || rawSourceData.tracks.length === 0) {
          rawSourceData.tracks = fallback_data.tracks ?? [];
        }
        if (!rawSourceData.intro) {
          rawSourceData.intro = fallback_data.intro ?? null;
        }
        if (!rawSourceData.outro) {
          rawSourceData.outro = fallback_data.outro ?? null;
        }

        console.log(`[megacloud] ✓ Fallback succeeded using ${fallback}`);
      } catch (fallbackError) {
        // Strategy 3: Try alternative fallback
        try {
          const altFallback = selectedServer.name.toLowerCase() === 'hd-1' ? fallback_2 : fallback_1;
          console.log(`[megacloud] First fallback failed, trying alternative: ${altFallback}`);

          const { data: html } = await retryOperation(
            () => axios.get(
              `https://${altFallback}/stream/s-2/${epID}/${selectedServer.type}`,
              {
                headers: {
                  ...BYPASS_HEADERS,
                  Referer: `https://${altFallback}/`,
                },
                timeout: RETRY_CONFIG.timeout,
              }
            ),
            2
          );

          const dataIdMatch = html.match(/data-id=["'](\d+)["']/);
          const realId = dataIdMatch?.[1];
          if (!realId) throw new Error('Could not extract data-id for alternative fallback');

          const altFallbackDataResult = await retryOperation(
            () => axios.get(
              `https://${altFallback}/stream/getSources?id=${realId}`,
              {
                headers: {
                  ...BYPASS_HEADERS,
                  'X-Requested-With': 'XMLHttpRequest',
                },
                timeout: RETRY_CONFIG.timeout,
              }
            ),
            2
          );

          const alt_fallback_data = altFallbackDataResult?.data;
          decryptedSources = [{ file: alt_fallback_data.sources.file }];
          
          if (!rawSourceData.tracks || rawSourceData.tracks.length === 0) {
            rawSourceData.tracks = alt_fallback_data.tracks ?? [];
          }
          if (!rawSourceData.intro) {
            rawSourceData.intro = alt_fallback_data.intro ?? null;
          }
          if (!rawSourceData.outro) {
            rawSourceData.outro = alt_fallback_data.outro ?? null;
          }

          console.log(`[megacloud] ✓ Alternative fallback succeeded using ${altFallback}`);
        } catch (altError) {
          throw new Error(`All strategies failed: main=${mainError.message}, fallback1=${fallbackError.message}, fallback2=${altError.message}`);
        }
      }
    }

    if (!decryptedSources) {
      throw new Error('Could not obtain decrypted sources from any strategy');
    }

    return {
      id,
      type: selectedServer.type,
      link: {
        file: decryptedSources?.[0]?.file ?? '',
        type: 'hls',
      },
      tracks: rawSourceData.tracks ?? [],
      intro: rawSourceData.intro ?? null,
      outro: rawSourceData.outro ?? null,
      server: selectedServer.name,
    };
  } catch (error) {
    console.error(`Error during megacloud decryption(${id}):`, error.message);
    return null;
  }
}
