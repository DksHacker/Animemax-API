import { axiosInstance } from '../services/axiosInstance.js';
import { validationError } from '../utils/errors.js';
import { extractHomepage } from '../extractor/extractHomepage.js';

import { Redis } from '@upstash/redis';

const homepageController = async () => {
  const isRedisEnv = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (isRedisEnv) {
    const redis = Redis.fromEnv();
    const cached = await redis.get('home');
    if (cached) return cached;

    const result = await axiosInstance('/home');
    if (!result.success) throw new validationError(result.message);

    const response = extractHomepage(result.data);
    await redis.set('home', JSON.stringify(response), { ex: 60 * 60 * 24 });
    return response;
  }

  const result = await axiosInstance('/home');
  if (!result.success) throw new validationError(result.message);
  return extractHomepage(result.data);
};

export default homepageController;
