const axios = require('axios');
const COOKIE = "_ga=GA1.1.1563299663.1756958715; session=9465d3e0-9871-4b82-84a2-3f82c1aeb82c; session.sig=OYSv4Y-zQHgnnUU2xfPUrrDZItM; _ga_GDNE9EKYHZ=GS2.1.s1756992429$o2$g1$t1756992902$j37$l0$h0";
const HEADERS = {
    'authority': 'congdong.ff.garena.vn',
    'accept': 'application/json, text/plain, /',
    'content-type': 'application/json',
    'cookie': COOKIE,
    'origin': 'https://congdong.ff.garena.vn',
    'referer': 'https://congdong.ff.garena.vn/tinh-diem',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
};

const garenaApi = {
    findMatches: async (accountId, start, end) => {
        const payload = { accountId, startTime: start.unix(), endTime: end.unix() };
        const response = await axios.post('https://congdong.ff.garena.vn/league-score-api/player/find-match', payload, { headers: HEADERS });
        return response.data?.matches;
    },
getMatchDetails: async (matchObjects) => {
    const promises = matchObjects.map(obj =>
      axios.post(
        'https://congdong.ff.garena.vn/league-score-api/match',
        { matchId: obj.id }, 
        { headers: HEADERS }
      )
      .then(res => {
        
        console.log(`MATCH DETAIL DATA id=${obj.id}:`, res.data);
        
        return res.data?.match || res.data?.matchDetail || res.data?.data?.match || null;
      })
      .catch(err => {
        console.error(`Error getMatchDetails id=${obj.id}:`, err.response?.data || err.message);
        return null;
      })
    );

    const responses = await Promise.all(promises);
    return responses.filter(Boolean); 
  }
};

module.exports = garenaApi;