const AD_PATTERNS = [
  'ad',
  'ads',
  'doubleclick',
  'googlesyndication',
  'adservice',
  'adserver',
  'advert',
  'popad',
  'banner',
  'promote',
  'sponsor',
  'adnetwork',
  'adsystem',
  'tracking',
  'tpc.googlesyndication',
];

const normalize = (v = '') => String(v).toLowerCase();

export const isAdName = (name) => {
  const n = normalize(name);
  // keep legitimate server names like HD-1..HD-4 even though they contain 'hd'
  if (!n) return false;
  return AD_PATTERNS.some((p) => n.includes(p));
};

export const filterServers = (serversObj) => {
  if (!serversObj) return serversObj;

  const cleanList = (list) =>
    (Array.isArray(list) ? list : []).filter((s) => {
      // Always keep the special HD-4 placeholder
      if (s && s.name && s.name.toUpperCase() === 'HD-4') return true;
      if (!s || !s.name) return false;
      return !isAdName(s.name);
    });

  return {
    ...serversObj,
    sub: cleanList(serversObj.sub),
    dub: cleanList(serversObj.dub),
  };
};

export const isAdUrl = (url) => {
  const u = normalize(url);
  if (!u) return false;
  return AD_PATTERNS.some((p) => u.includes(p));
};

export default {
  isAdName,
  filterServers,
  isAdUrl,
};
