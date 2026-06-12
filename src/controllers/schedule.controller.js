import { validationError } from '../utils/errors.js';
import config from '../config/config.js';
import extractSchadule from '../extractor/extractSchadule.js';
import { axiosInstance } from '../services/axiosInstance.js';

async function schaduleController(c) {
  const today = new Date(Date.now());

  let todaysMonth = today.getMonth() + 1;
  let todaysDate = today.getDate();
  const todaysYear = today.getFullYear();

  let date = c.req.query('date') || todaysDate;

  if (date < 1) throw new validationError('date cant be less than 1');

  const lastDateOfMonth = new Date(todaysYear, todaysMonth, 0).getDate();

  if (date > lastDateOfMonth)
    throw new validationError(`date cant be more that ${lastDateOfMonth}`);

  todaysMonth = todaysMonth < 10 ? `0${todaysMonth}` : todaysMonth;
  date = date < 10 ? `0${date}` : date;

  const formattedDate = `${todaysYear}-${todaysMonth}-${date}`;

  const ajaxUrl = `/ajax/schedule/list?tzOffset=-330&date=${formattedDate}`;

  try {
    const result = await axiosInstance(ajaxUrl, {
      headers: {
        Referer: config.baseurl + '/home',
      },
    });

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch schedule');
    }

    // axios returns already-parsed JSON
    const jsonData = result.data;

    if (!jsonData || !jsonData.html) {
      throw new Error('No schedule data in response');
    }

    // saveHtml(jsonData.html, 'schadule.html');
    const meta = {
      date: formattedDate,
    };
    const response = extractSchadule(jsonData.html);
    return { meta, response };
  } catch (error) {
    console.error('[ScheduleController]', error.message);
    throw new validationError('page not found');
  }
}

export default schaduleController;
