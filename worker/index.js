const PUBLIC_RPCS = new Set([
  'pilot_public_catalogue', 'pilot_available_slots', 'pilot_track_booking_v2',
]);
const STAFF_RPCS = new Set([
  'pilot_is_staff', 'pilot_queue_v2', 'pilot_update_order',
  'pilot_marketing_consent', 'pilot_withdraw_offers',
  'pilot_record_payment_v3', 'pilot_loyalty_redeem_v2', 'pilot_loyalty_welcome',
]);
const MAX_BODY = 64 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin ? origin === new URL(request.url).origin : request.method === 'GET';
}

async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY) throw new Error('Request is too large.');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY) throw new Error('Request is too large.');
  try { return JSON.parse(new TextDecoder().decode(bytes) || '{}'); }
  catch { throw new Error('A valid JSON request is required.'); }
}

function authHeaders(env, token) {
  const headers = new Headers({ apikey: env.SUPABASE_ANON_KEY });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

function serviceRoleHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return new Headers({ apikey: key, Authorization: `Bearer ${key}` });
}

async function upstream(request, env, path, body, token, useServiceRole = false) {
  const headers = useServiceRole ? serviceRoleHeaders(env) : authHeaders(env, token);
  const init = { method: request.method, headers, redirect: 'manual' };
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}${path}`, init);
  } catch {
    return json({ message: 'The database connection is unavailable.' }, 503);
  }
  const outHeaders = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
  });
  return new Response(response.body, { status: response.status, headers: outHeaders });
}

function validBookingRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
  const allowed = new Set([
    'website', 'name', 'phone', 'sport', 'shop', 'payment', 'src', 'marketing_opt_in', 'advance',
    'gear', 'string_key', 'colour', 'colour_other', 'mains', 'crosses', 'knots', 'pre_stretch',
    'urgent', 'slot_date', 'slot_start', 'jobs', 'help_choose', 'note',
  ]);
  if (Object.keys(request).some(key => !allowed.has(key))) return false;
  if (typeof request.website !== 'string') return false;
  if (typeof request.name !== 'string' || request.name.trim().length < 1 || request.name.trim().length > 80) return false;
  if (typeof request.phone !== 'string') return false;
  const phone = request.phone.replace(/\D/g, '');
  const normalizedPhone = phone.length === 12 && phone.startsWith('91') ? phone.slice(2) : phone;
  if (!/^[6-9][0-9]{9}$/.test(normalizedPhone)) return false;
  if (!['badminton', 'cricket', 'shoe'].includes(request.sport)) return false;
  if (!['6th', '5th'].includes(request.shop) || !['UPI', 'Cash', 'Card'].includes(request.payment)) return false;
  if (typeof request.marketing_opt_in !== 'boolean' || !/^(0|[1-9][0-9]{0,6})$/.test(String(request.advance ?? ''))) return false;
  if (typeof request.src !== 'string' || request.src.length > 100) return false;
  if (typeof request.gear !== 'string' || request.gear.length > 120) return false;
  if (typeof request.note !== 'string' || request.note.length > 600) return false;

  if (request.sport === 'badminton') {
    if (request.gear.trim().length < 2 || typeof request.string_key !== 'string' || !request.string_key) return false;
    if (typeof request.colour !== 'string' || request.colour.length > 40) return false;
    if (request.colour === 'Other' && (typeof request.colour_other !== 'string' || request.colour_other.trim().length < 2 || request.colour_other.length > 40)) return false;
    if (!['2', '4'].includes(String(request.knots)) || !/^(1[8-9]|2[0-9]|3[0-5])$/.test(String(request.mains)) || !/^(1[8-9]|2[0-9]|3[0-5])$/.test(String(request.crosses))) return false;
    if (typeof request.pre_stretch !== 'boolean' || typeof request.urgent !== 'boolean') return false;
    if (!request.urgent && (!/^\d{4}-\d{2}-\d{2}$/.test(String(request.slot_date)) || !/^\d{2}:\d{2}$/.test(String(request.slot_start)))) return false;
  } else if (request.sport === 'cricket') {
    if (!Array.isArray(request.jobs) || request.jobs.length < 1 || request.jobs.length > 9 || request.jobs.some(job => typeof job !== 'string' || !job || job.length > 80)) return false;
  } else if (request.note.trim().length < 3) return false;

  return new TextEncoder().encode(JSON.stringify(request)).byteLength <= 8000;
}

async function api(request, env, path) {
  if (!allowedOrigin(request)) return json({ message: 'Cross-origin requests are not accepted.' }, 403);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return json({ message: 'The service is not configured.' }, 503);
  }

  if (path === '/api/health') {
    if (request.method !== 'GET') return json({ message: 'Method not allowed.' }, 405);
    let ping;
    try {
      ping = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/pilot_public_catalogue`, {
        method: 'POST', headers: authHeaders(env), body: '{}',
      });
    } catch { return json({ status: 'unavailable' }, 503); }
    await ping.body?.cancel();
    return ping.ok ? json({ status: 'ok' }) : json({ status: 'unavailable' }, 503);
  }

  if (path === '/api/orders') {
    if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
    let body;
    try { body = await readJson(request); }
    catch (error) { return json({ message: error.message }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !body.request || typeof body.request !== 'object' || Array.isArray(body.request) ||
        typeof body.key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.key)) {
      return json({ message: 'Booking details are incomplete.' }, 400);
    }
    if (typeof body.request.website !== 'string') return json({ message: 'Check the booking details and try again.' }, 400);
    if (body.request.website.trim()) return json({ message: 'Booking request could not be completed.' }, 400);
    if (!validBookingRequest(body.request)) return json({ message: 'Check the booking details and try again.' }, 400);
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ message: 'The booking service is not configured.' }, 503);
    const { website, ...booking } = body.request;
    return upstream(request, env, '/rest/v1/rpc/pilot_create_booking_v2', {
      p_request: booking, p_key: body.key,
    }, undefined, true);
  }

  if (path === '/api/auth/token') {
    if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
    const grant = new URL(request.url).searchParams.get('grant_type');
    if (!['password', 'refresh_token'].includes(grant)) return json({ message: 'Unsupported sign-in method.' }, 400);
    let body;
    try { body = await readJson(request); }
    catch (error) { return json({ message: error.message }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ message: 'A valid sign-in request is required.' }, 400);
    return upstream(request, env, `/auth/v1/token?grant_type=${grant}`, body);
  }

  if (path === '/api/auth/logout') {
    if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
    const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/)?.[1];
    if (!token) return json({ message: 'Sign in with an approved staff account.' }, 401);
    return upstream(request, env, '/auth/v1/logout', undefined, token);
  }

  const rpc = path.match(/^\/api\/rpc\/([a-z0-9_]+)$/i);
  if (rpc) {
    if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
    const name = rpc[1];
    const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/)?.[1];
    const isStaffRpc = STAFF_RPCS.has(name);
    if ((!PUBLIC_RPCS.has(name) && !isStaffRpc) || (isStaffRpc && !token)) {
      return json({ message: 'Sign in with an approved staff account.' }, 403);
    }
    let body;
    try { body = await readJson(request); }
    catch (error) { return json({ message: error.message }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ message: 'A valid request is required.' }, 400);
    return upstream(request, env, `/rest/v1/rpc/${name}`, body, token);
  }
  return json({ message: 'Not found.' }, 404);
}

function redirect(url, destination) {
  const target = new URL(destination, url);
  target.search = url.search;
  target.hash = url.hash;
  return Response.redirect(target, 302);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url.pathname);
    if (['/', '/index.html', '/concept', '/concept/', '/gear-care.html', '/stringing.html'].includes(url.pathname)) {
      return redirect(url, '/book/');
    }
    if (['/pilot', '/pilot/', '/pilot/index.html'].includes(url.pathname)) return redirect(url, '/book/');
    if (url.pathname === '/pilot/staff.html') return redirect(url, '/book/staff.html');
    if (['/pilot/track.html', '/pilot/print-qr.html'].includes(url.pathname)) return redirect(url, '/book/status.html');
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller, env, ctx) {
    const healthRequest = new Request('https://worker.internal/api/health', {
      method: 'GET', headers: { Origin: 'https://worker.internal' },
    });
    ctx.waitUntil(api(healthRequest, env, '/api/health').then(async response => {
      if (!response.ok) throw new Error('The scheduled Supabase health check failed.');
      await response.body?.cancel();
    }));
  },
};
