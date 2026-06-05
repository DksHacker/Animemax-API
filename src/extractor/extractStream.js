import axios from 'axios';
import config from '../config/config.js';

/**
 * Fetches the streaming URL for a selected server.
 *
 * Uses anikoto.cz /ajax/server?get={encodedLinkId}
 * which returns:
 *  {
 *    status: 200,
 *    result: {
 *      url: "https://megaplay.buzz/stream/s-2/{epId}/{type}",
 *      skip_data: { intro: [0,0], outro: [0,0] }
 *    }
 *  }
 */
export const extractStream = async ({ selectedServer, id }) => {
  const slugPart = id.split('::ep=')[0];
  const Referer = `${config.baseurl}/watch/${slugPart}`;

  try {
    const { data } = await axios.get(
      `${config.baseurl}/ajax/server?get=${encodeURIComponent(selectedServer.linkId)}`,
      {
        headers: {
          ...config.headers,
          Referer,
        },
      }
    );

    if (data.status !== 200 || !data.result?.url) {
      throw new Error(data.result?.message || 'Failed to get stream URL');
    }

    return {
      id,
      type: selectedServer.type,
      link: {
        file: data.result.url,
        type: 'embed',          // megaplay.buzz returns an iframe embed URL
      },
      tracks: [],
      intro: data.result.skip_data?.intro ?? null,
      outro: data.result.skip_data?.outro ?? null,
      server: selectedServer.name,
    };
  } catch (error) {
    console.error(`extractStream error for ${id}:`, error.message);
    return null;
  }
};
