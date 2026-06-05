import axios from 'axios';
import * as cheerio from 'cheerio';
import { validationError } from '../utils/errors.js';
import config from '../config/config.js';
import { extractEpisodes } from '../extractor/extractEpisodes.js';

/**
 * Resolves the anikoto numeric anime ID from a slug.
 * The watch page contains: const mangaId = 1642;
 */
const resolveAnimeId = async (slug) => {
  const { data: html } = await axios.get(`${config.baseurl}/watch/${slug}`, {
    headers: config.headers,
  });

  // Try inline script: const mangaId = 1234;
  const scriptMatch = html.match(/\bconst\s+mangaId\s*=\s*(\d+)/);
  if (scriptMatch) return scriptMatch[1];

  // Fallback: data-id attribute on main anime element
  const $ = cheerio.load(html);
  const dataId = $('[data-id]').first().attr('data-id');
  if (dataId) return dataId;

  throw new Error(`Could not resolve anime ID for slug: ${slug}`);
};

const episodesController = async (c) => {
  const slug = c.req.param('id');
  if (!slug) throw new validationError('id is required');

  try {
    const animeId = await resolveAnimeId(slug);
    const { data } = await axios.get(
      `${config.baseurl}/ajax/episode/list/${animeId}`,
      {
        headers: {
          ...config.headers,
          Referer: `${config.baseurl}/watch/${slug}`,
        },
      }
    );

    if (data.status !== 200) {
      throw new Error(data.result || 'Failed to fetch episode list');
    }

    const episodes = extractEpisodes(data.result);
    return { animeId: Number(animeId), episodes };
  } catch (err) {
    console.log(err.message);
    throw new validationError('make sure the id is correct', { validIdEX: 'steinsgate-3' });
  }
};

export default episodesController;
