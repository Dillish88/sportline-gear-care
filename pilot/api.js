window.PilotAPI = {
  async request(path, body, token) {
    const c = window.PILOT_CONFIG;
    if (!c?.enabled) throw new Error('Pilot setup is not active yet. Please ask the counter team.');
    let response;
    try {
      response = await fetch(c.url + path, {
        method: 'POST', headers: {apikey: c.key, 'Content-Type': 'application/json', ...(token ? {Authorization:'Bearer '+token} : {})},
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
  rpc(name, body = {}, token) { return this.request('/rest/v1/rpc/' + name, body, token); }
};
