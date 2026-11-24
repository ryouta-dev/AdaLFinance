import { latestCase } from '../content/catalog.mjs';
import { lessonSnapshot } from '../content/lessons.mjs';
import { caseKey } from '../content/academy.mjs';
import { cookie, currentUser, demoScope, digest, people, setCookie, signIn, signOut } from './auth.mjs';
import { applyAction, openShift } from './shift.mjs';
import { views } from './views.mjs';
import { lessonViews } from './lesson-views.mjs';
import { platformViews } from './platform-views.mjs';
import { platformRoute, join } from './platform-routes.mjs';
import { applyLesson, openLesson } from './lesson.mjs';
import { applyRegister, openRegister } from './register.mjs';
import { registerViews } from './register-views.mjs';
import { customCases, deserialize, userAttempts } from './storage.mjs';
import { cupCases } from './analytics.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const baseHeaders = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
function redirect(path, session) {
  const headers = new Headers({ ...baseHeaders, location: path });
  for (const value of [session].flat()) if (value) headers.append('set-cookie', value);
  return new Response(null, { status: 303, headers });
}

async function form(request, limit = 4096) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return null;
  if (Number(request.headers.get('content-length')) > limit) return null;
  const body = await request.text();
  return body.length <= limit ? new URLSearchParams(body) : null;
}

function backTo(origin, back) {
  if (!back?.startsWith('/') || back.startsWith('//')) return '/';
  try {
    const url = new URL(back, origin);
    return url.origin === origin && /^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*$/.test(url.pathname) ? url.pathname + url.search : '/';
  } catch {
    return '/';
  }
}

async function cupId(user, config) {
  const key = await digest('cup-2026/' + user.group + '/' + user.username + '/' + caseKey(config));
  return [key.slice(0, 8), key.slice(8, 12), key.slice(12, 16), key.slice(16, 20), key.slice(20, 32)].join('-');
}

async function fetch(request, env) {
  const { pathname, origin, search, searchParams } = new URL(request.url);
  if (request.method === 'GET' && pathname.startsWith('/assets/')) return env.asset(pathname);
  const db = env.DB;
  const publicDemo = env.PUBLIC_DEMO === '1';
  const lang = cookie(request, 'adal_lang') === 'kk' ? 'kk' : 'ru';
  const view = views(lang);
  const lesson = lessonViews(lang, view);
  const register = registerViews(lang, view);
  const ui = platformViews(lang, view);
  let user;
  const page = (title, body, status = 200) => new Response(view.layout(view.tx(title), body, user, pathname + search), {
    status, headers: { ...baseHeaders, 'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'referrer-policy': 'same-origin' }
  });
  const error = (key, status) => page(key, view.error(key), status);

  try {
    const post = request.method === 'POST';
    if (request.method !== 'GET' && !post) return error('missing', 405);
    if (post && request.headers.get('origin') !== origin) return error('security', 403);

    if (pathname === '/language' && !post) {
      const next = searchParams.get('lang') === 'kk' ? 'kk' : 'ru';
      const back = searchParams.get('back');
      return redirect(backTo(origin, back), setCookie(request, 'adal_lang', next, 31536000));
    }

    if (pathname === '/login' && post) {
      const fields = await form(request);
      const profile = publicDemo ? fields?.get('profile') : null;
      const name = profile ?? fields?.get('username')?.trim().toLowerCase();
      const account = Object.hasOwn(people, name) ? people[name] : null;
      if (!account || (!profile && fields?.get('password') !== account.password)) return page('loginTitle', view.login(true, publicDemo), 401);
      return redirect(account.role === 'teacher' ? '/teacher' : '/', await signIn(db, request, account, publicDemo ? demoScope(request) : ''));
    }
    if (pathname === '/logout' && post) return redirect('/login', await signOut(db, request));

    const invitation = pathname.match(/^\/enter\/([a-f0-9-]+)$/);
    if (invitation) return await join(request, db, invitation[1], ui, page, redirect);
    user = await currentUser(db, request);
    if (!user) return pathname === '/login' ? page('loginTitle', view.login(false, publicDemo)) : redirect('/login');
    if (pathname === '/login' || (pathname === '/' && user.role === 'teacher')) return redirect(user.role === 'teacher' ? '/teacher' : '/');

    const teacher = pathname === '/teacher' || pathname.startsWith('/teacher/');
    if (pathname !== '/accounts' && teacher !== (user.role === 'teacher')) return error('security', 403);
    if (!post && pathname === '/teacher') {
      return page('teacherHome', view.cabinet(user, [], await userAttempts(db, user)));
    }

    const extension = await platformRoute({ request, db, user, ui, lesson, page, pathname, origin, searchParams, form, redirect, error, lang });
    if (extension) return extension;

    const caseMatch = pathname.match(/^\/case\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (caseMatch && !teacher) {
      const cup = searchParams.get('cup') === '1';
      const config = latestCase(caseMatch[1], caseMatch[2], cup ? undefined : await customCases(db, user.group));
      if (!config || (cup && !cupCases.includes(caseKey(config)))) return error('missing', 404);
      const lessonFlow = config.flow === 'lesson';
      const registerFlow = config.flow === 'register';
      if (!post) {
        if (cup) {
          const current = await db.prepare('SELECT id FROM attempts WHERE id = ? AND owner = ? AND group_id = ?').bind(await cupId(user, config), user.username, user.group).first();
          if (current) return redirect('/attempt/' + current.id);
        }
        if (registerFlow) return page('cases', register.brief(config));
        return page(lessonFlow ? 'cases' : 'steps', lessonFlow ? lesson.brief(config, cup) : view.open(config, cup));
      }
      const requestId = (await form(request))?.get('request');
      if (!uuid.test(requestId)) return error('invalid', 400);
      const id = cup ? await cupId(user, config) : requestId;
      const at = new Date().toISOString();
      const variant = config.variants?.[crypto.getRandomValues(new Uint32Array(1))[0] % config.variants.length];
      const snapshot = variant ? lessonSnapshot(config, variant) : config;
      const state = lessonFlow ? openLesson(requestId, at, cup)
        : registerFlow ? openRegister(requestId, at) : openShift(requestId, at, cup);
      await db.prepare('INSERT INTO attempts (id, owner, group_id, config, state, started_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
        .bind(id, user.username, user.group, JSON.stringify(snapshot), JSON.stringify(state), at).run();
      return redirect(`/attempt/${id}`);
    }

    const attemptMatch = pathname.match(/^\/(?:teacher\/)?attempt\/([a-f0-9-]+)$/);
    if (!attemptMatch || !uuid.test(attemptMatch[1])) return error('missing', 404);
    const id = attemptMatch[1];
    const row = teacher ? await db.prepare('SELECT * FROM attempts WHERE id = ? AND group_id = ?').bind(id, user.group).first()
      : await db.prepare('SELECT * FROM attempts WHERE id = ? AND group_id = ? AND owner = ?').bind(id, user.group, user.username).first();
    if (!row) return error('missing', 404);
    const attempt = deserialize(row);
    const lessonFlow = attempt.config.flow === 'lesson';
    const registerFlow = attempt.config.flow === 'register';
    if (!post) {
      const retry = searchParams.get('error');
      const retryMessage = ['stale', 'invalid'].includes(retry) ? retry : null;
      if (registerFlow) {
        const practiceError = ['basketError', 'tenderError', 'returnError'].includes(retry) ? retry : retryMessage;
        return page('cases', register.draw(attempt, teacher, practiceError));
      }
      if (teacher || attempt.finished_at) return page('result', lessonFlow
        ? lesson.result(attempt, people[attempt.owner], teacher)
        : view.result(attempt, teacher));
      return page(lessonFlow ? 'cases' : 'steps', lessonFlow ? lesson.work(attempt, retryMessage) : view.work(attempt, retryMessage));
    }

    if (teacher) return error('security', 403);
    const fields = await form(request);
    const requestId = fields?.get('request');
    if (!uuid.test(requestId)) return error('invalid', 400);
    if (attempt.state.events.some(event => event.request === requestId)) return redirect(pathname);
    if (fields.get('revision') !== String(attempt.revision)) return redirect(`${pathname}?error=stale`);
    const at = new Date().toISOString();
    const action = fields.get('action');
    const next = lessonFlow ? await applyLesson(attempt.config, attempt.state, action, fields, requestId, at, env, lang)
      : registerFlow ? applyRegister(attempt.config, attempt.state, action, fields, requestId, at)
        : applyAction(attempt.config, attempt.state, action, fields, requestId, at);
    if (!next) return redirect(`${pathname}?error=invalid`);
    if (next.invalid) return redirect(pathname + '?error=' + next.invalid);
    if (next === attempt.state) return redirect(pathname);
    const updated = await db.prepare('UPDATE attempts SET state = ?, revision = revision + 1, finished_at = ? WHERE id = ? AND owner = ? AND revision = ?')
      .bind(JSON.stringify(next), next.step === 'done' ? at : null, id, user.username, attempt.revision).run();
    return redirect(updated.meta.changes ? pathname : `${pathname}?error=stale`);
  } catch (failure) {
    console.error(failure);
    return error('genericError', 500);
  }
}

export default { fetch };
