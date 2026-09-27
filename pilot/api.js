window.PilotAPI = {
  async request(path, body, token) {
    const c = window.PILOT_CONFIG;
    const direct = location.hostname === 'sportline-gear-care.vercel.app' && !!(c?.url && c?.key);
    let response;
    try {
      if (!/^\/api\/[a-z0-9_/?=&-]+$/i.test(path)) throw new Error('Unsupported pilot API request.');
      let target = path;
      const headers = {'Content-Type': 'application/json', ...(token ? {Authorization:'Bearer '+token} : {})};
      if (direct) {
        if (path.startsWith('/api/rpc/')) target = path.replace(/^\/api\/rpc\//, '/rest/v1/rpc/');
        else if (path.startsWith('/api/auth/token')) target = path.replace(/^\/api\/auth\/token/, '/auth/v1/token');
        else if (path === '/api/auth/logout') target = '/auth/v1/logout';
        else throw new Error('Unsupported pilot API request.');
        target = c.url.replace(/\/$/, '') + target;
        headers.apikey = c.key;
      }
      response = await fetch(target, {
        method: 'POST', headers,
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
      });
    } catch { throw new Error('The connection was interrupted. Please try again.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.code === 'P0001' ? data.message
        : response.status === 401 || response.status === 403 || data?.code === '42501' ? 'Sign in with an approved staff account.'
        : data?.error_code === 'invalid_credentials' ? 'Check your email and password.'
        : 'The request could not be completed. Please try again or ask the counter team.';
      throw new Error(message);
    }
    return data;
  },
  rpc(name, body = {}, token) { return this.request('/api/rpc/' + encodeURIComponent(name), body, token); }
};
