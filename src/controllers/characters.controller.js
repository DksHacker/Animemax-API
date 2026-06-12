import { validationError } from '../utils/errors.js';
import config from '../config/config.js';
import { extractCharacters } from '../extractor/extractCharacters.js';
import { axiosInstance } from '../services/axiosInstance.js';

const charactersController = async (c) => {
  const id = c.req.param('id');
  const page = c.req.query('page') || 1;

  if (!id) throw new validationError('id is required');

  const idNum = id.split('-').pop();
  const endpoint = `/ajax/character/list/${idNum}?page=${page}`;
  try {
    const Referer = `${config.baseurl}/home`;
    const result = await axiosInstance(endpoint, {
      headers: {
        Referer,
      },
    });

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch characters');
    }

    // axios returns already-parsed JSON
    const jsonData = result.data;

    if (!jsonData || !jsonData.html) {
      throw new Error('No characters data in response');
    }

    const response = extractCharacters(jsonData.html);

    return response;
  } catch (err) {
    console.log('[CharactersController] Error:', err);

    throw new validationError('characters not found');
  }
};

export default charactersController;
