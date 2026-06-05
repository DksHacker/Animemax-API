import axios from 'axios';
import { validationError } from '../utils/errors.js';
import config from '../config/config.js';
import { extractServers } from '../extractor/extractServers.js';

/**
 * Fetches the server list for an episode.
 *
 * id format:  {anime-slug}::ep={dataIds}
 * e.g.        steinsgate-3::ep=cTFsbUc1WkRE...
 *
 * The dataIds is the base64-encoded value from data-ids attribute
 * of the episode <a> element returned by /ajax/episode/list/{animeId}
 */
export const getServers = async (id) => {
  const [slugPart, epPart] = id.split('::ep=');
  if (!slugPart || !epPart) {
    throw new validationError('invalid id format', {
      validIdEx: 'steinsgate-3::ep={dataIds}',
    });
  }

  const Referer = `${config.baseurl}/watch/${slugPart}`;

  try {
    const { data } = await axios.get(
      `${config.baseurl}/ajax/server/list?servers=${encodeURIComponent(epPart)}`,
      {
        headers: {
          ...config.headers,
          Referer,
        },
      }
    );

    if (data.status !== 200) {
      throw new Error(data.result || 'Server list request failed');
    }

    return extractServers(data.result);
  } catch (err) {
    console.log(err.message);
    throw new validationError('make sure given endpoint is correct', {
      validIdEx: 'steinsgate-3::ep={dataIds}',
    });
  }
};

const serversController = async (c) => {
  const id = c.req.query('id');
  if (!id) throw new validationError('id is required');

  const response = await getServers(id);
  return response;
};

export default serversController;
