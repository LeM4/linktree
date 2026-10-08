import { timingSafeEqual, createHash } from 'crypto';

const digest = (value) => createHash('sha256').update(String(value)).digest();
const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

/** HTTP Basic auth for every admin route except the given public paths. */
export function basicAuth({ username, password, realm = 'Linktree Admin', publicPaths = [] }) {
  return async function (request, reply) {
    if (publicPaths.includes(request.routeOptions?.url)) return;

    const header = request.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      // Evaluate both comparisons to keep timing independent of which part is wrong.
      const ok = [safeEqual(user, username), safeEqual(pass, password)].every(Boolean);
      if (sep >= 0 && ok) return;
    }

    reply
      .code(401)
      .header('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`)
      .type('text/plain')
      .send('Authentication required');
    return reply;
  };
}

/** Rejects cross-site state-changing requests (CSRF) based on Origin/Referer. */
export async function sameOrigin(request, reply) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const source = request.headers.origin || request.headers.referer;
  if (!source) return;
  let host;
  try {
    host = new URL(source).host;
  } catch {
    host = null;
  }
  if (host && host === request.host) return;
  reply.code(403).type('text/plain').send('Cross-origin request blocked');
  return reply;
}
