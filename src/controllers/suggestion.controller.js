import { validationError } from '../utils/errors';
import config from '../config/config';
import { extractSuggestions } from '../extractor/extractSuggestions';
import { axiosInstance } from '../services/axiosInstance';

const suggestionController = async (c) => {
  const keyword = c.req.query('keyword') || null;

  if (!keyword) throw new validationError('query is required');

  const noSpaceKeyword = keyword.trim().toLowerCase().replace(/\s+/g, '+');

  const endpoint = `/ajax/search/suggest?keyword=${noSpaceKeyword}`;
  const Referer = `${config.baseurl}/home`;
  
  try {
    const result = await axiosInstance(endpoint, {
      headers: {
        Referer,
      },
    });

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch suggestions');
    }

    // axios returns already-parsed JSON
    const jsonData = result.data;

    if (!jsonData?.status) throw new validationError('suggestion not found');

    const response = extractSuggestions(jsonData.html);

    return response;
  } catch (err) {
    console.log('[SuggestionController] Error:', err.message);
    throw new validationError('suggestion not found');
  }
};

export default suggestionController;
