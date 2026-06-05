import * as cheerio from 'cheerio';

export const extractHomepage = (html) => {
  const $ = cheerio.load(html);

  const response = {
    spotlight: [],
    trending: [],
    latestEpisode: [],
    topUpcoming: [],
    top10: {
      today: [],
      week: [],
      month: [],
    },
    genres: [],
  };

  // ── Spotlight: #hotest swiper slides ──────────────────────────
  $('#hotest .swiper-slide.item').each((i, el) => {
    const titleEl = $(el).find('.title.d-title');
    const href = $(el).find('.actions a.play').attr('href') || '';
    const slug = href.split('/watch/').at(-1)?.split('/')[0] || null;
    const bgStyle = $(el).find('.image div[style]').attr('style') || '';
    const posterMatch = bgStyle.match(/url\(['"]?([^'")\s]+)['"]?\)/);

    const metaEl = $(el).find('.meta.icons');
    response.spotlight.push({
      rank: i + 1,
      title: titleEl.text().trim() || null,
      alternativeTitle: titleEl.attr('data-jp') || null,
      id: slug,
      poster: posterMatch?.[1] || null,
      synopsis: $(el).find('.synopsis').text().trim() || null,
      type: metaEl.find('.rating').text().trim() || null,
      quality: metaEl.find('.quality').text().trim() || null,
      aired: metaEl.find('.date').text().trim() || null,
      episodes: {
        sub: metaEl.find('.sub').length ? 1 : null,
        dub: metaEl.find('.dub').length ? 1 : null,
        eps: null,
      },
    });
  });

  // ── Latest Episodes: #recent-update ──────────────────────────
  $('#recent-update .item').each((i, el) => {
    const titleEl = $(el).find('.d-title, .title').first();
    const href = $(el).find('a').first().attr('href') || '';
    const slug = href.split('/watch/').at(-1)?.split('/')[0] || null;
    const poster =
      $(el).find('img').attr('src') ||
      $(el).find('img').attr('data-src') ||
      $(el).find('[data-src]').attr('data-src') ||
      null;
    const epNum = href.match(/\/ep-(\d+)/)?.[1] || null;

    response.latestEpisode.push({
      title: titleEl.attr('title') || titleEl.text().trim() || null,
      alternativeTitle: titleEl.attr('data-jp') || null,
      id: slug,
      poster,
      episodeNumber: epNum ? Number(epNum) : null,
      episodes: {
        sub: $(el).find('.sub').length ? 1 : null,
        dub: $(el).find('.dub').length ? 1 : null,
        eps: null,
      },
    });
  });

  // ── Upcoming: #upcoming-anime ─────────────────────────────────
  $('#upcoming-anime .item').each((i, el) => {
    const titleEl = $(el).find('.d-title, .title').first();
    const href = $(el).find('a').first().attr('href') || '';
    const slug = href.split('/watch/').at(-1)?.split('/')[0] || null;
    const poster =
      $(el).find('img').attr('src') ||
      $(el).find('img').attr('data-src') ||
      null;

    response.topUpcoming.push({
      title: titleEl.attr('title') || titleEl.text().trim() || null,
      alternativeTitle: titleEl.attr('data-jp') || null,
      id: slug,
      poster,
    });
  });

  // ── Top 10: #top-anime (day / week / month tabs) ─────────────
  const parseTopTab = (tabName) => {
    const items = [];
    $(`#top-anime .tab-content[data-name="${tabName}"] .item`).each((i, el) => {
      const titleEl = $(el).find('.d-title, .title').first();
      const href = $(el).find('a').first().attr('href') || $(el).attr('href') || '';
      const slug = href.split('/watch/').at(-1)?.split('/')[0] || null;
      const animeId = $(el).find('[data-tip]').attr('data-tip') || null;
      const poster =
        $(el).find('img').attr('src') ||
        $(el).find('img').attr('data-src') ||
        null;

      items.push({
        rank: i + 1,
        title: titleEl.text().trim() || null,
        alternativeTitle: titleEl.attr('data-jp') || null,
        id: slug,
        animeId: animeId ? Number(animeId) : null,
        poster,
        episodes: {
          sub: null,
          dub: null,
          eps: null,
        },
      });
    });
    return items;
  };

  response.top10.today = parseTopTab('day');
  response.top10.week = parseTopTab('week');
  response.top10.month = parseTopTab('month');

  // ── Trending: use spotlight fallback or swiper outside hotest ─
  // anikoto doesn't have a separate trending section — use spotlight
  response.trending = response.spotlight.map((s) => ({
    title: s.title,
    alternativeTitle: s.alternativeTitle,
    rank: s.rank,
    poster: s.poster,
    id: s.id,
  }));

  // ── Genres ───────────────────────────────────────────────────
  $('#menu li a[href*="/genre/"]').each((i, el) => {
    const genre = $(el).attr('title') || $(el).find('h3').text().trim() || $(el).text().trim();
    if (genre) response.genres.push(genre.toLowerCase());
  });

  return response;
};
