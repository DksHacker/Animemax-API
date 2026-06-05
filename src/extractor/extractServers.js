import { load } from 'cheerio';

/**
 * Parses HTML from anikoto.cz /ajax/server/list?servers={dataIds}
 * Each <li> has:
 *   data-ep-id   – numeric episode ID
 *   data-sv-id   – server code (e.g. "e54", "a41")
 *   data-link-id – encoded link ID (used with /ajax/server?get=)
 *   data-type    – "sub" or "dub" (from parent .type div)
 *   text         – server name (e.g. "Vidstream-2")
 */
export const extractServers = (html) => {
  const $ = load(html);

  const sub = [];
  const dub = [];

  $('.servers .type').each((i, typeEl) => {
    const type = $(typeEl).attr('data-type'); // "sub" or "dub"
    $(typeEl).find('li').each((j, li) => {
      const server = {
        epId: $(li).attr('data-ep-id'),
        svId: $(li).attr('data-sv-id'),
        linkId: $(li).attr('data-link-id'),
        name: $(li).text().trim(),
        type,
      };
      if (type === 'sub') sub.push(server);
      else if (type === 'dub') dub.push(server);
    });
  });

  return { sub, dub };
};
