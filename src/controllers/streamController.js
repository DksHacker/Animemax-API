import { validationError } from '../utils/errors.js';
import { getServers } from './serversController.js';
import { extractStream } from '../extractor/extractStream.js';

/**
 * GET /api/v1/stream?id={slug}::ep={dataIds}&server=Vidstream-2&type=sub
 *
 * id format: {anime-slug}::ep={dataIds}
 *   slug     – anime slug  e.g. steinsgate-3
 *   dataIds  – base64 data-ids value from the episode element
 *
 * server: server name e.g. "Vidstream-2", "VidCloud-1"  (default: Vidstream-2)
 * type:   "sub" or "dub"                                 (default: sub)
 */
const streamController = async (c) => {
  let { id, server = 'Vidstream-2', type = 'sub' } = c.req.query();

  if (!id) throw new validationError('id is required');
  if (!id.includes('::ep=')) throw new validationError('id must include ::ep= with dataIds');

  const servers = await getServers(id);
  const pool = type === 'dub' ? servers.dub : servers.sub;

  // Find by name (case-insensitive) or fall back to first available
  const selectedServer =
    pool.find((s) => s.name.toLowerCase() === server.toLowerCase()) || pool[0];

  if (!selectedServer) {
    throw new validationError('no servers available', { type, availableSub: servers.sub.map(s => s.name), availableDub: servers.dub.map(s => s.name) });
  }

  const response = await extractStream({ selectedServer, id });

  if (!response) {
    throw new validationError('failed to extract stream URL');
  }

  return response;
};

export default streamController;
