import { load } from 'cheerio';

/**
 * Parses the HTML result from anikoto.cz /ajax/episode/list/{animeId}
 * Each <a> element contains:
 *   data-id     – numeric episode row ID (used for server list lookup)
 *   data-num    – episode number
 *   data-slug   – episode slug (same as num usually)
 *   data-sub    – "1" if sub available
 *   data-dub    – "1" if dub available
 *   data-ids    – base64-encoded server bundle (needed for /ajax/server/list)
 */
export const extractEpisodes = (html) => {
  const $ = load(html);
  const response = [];

  $('a[data-id][data-num]').each((i, el) => {
    response.push({
      episodeNumber: Number($(el).attr('data-num')),
      title: $(el).closest('li').attr('title') || null,
      alternativeTitle: null,
      id: $(el).attr('data-id'),          // numeric row ID for server lookup
      dataIds: $(el).attr('data-ids'),    // encoded server bundle
      isFiller: false,
      hasSub: $(el).attr('data-sub') === '1',
      hasDub: $(el).attr('data-dub') === '1',
    });
  });

  return response;
};
