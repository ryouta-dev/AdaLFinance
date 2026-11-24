import { caseKey, company } from '../content/academy.mjs';
import { availableCases, catalog } from '../content/catalog.mjs';
import { team } from '../content/team.mjs';
import { matchesKey, readAnswers } from './lesson.mjs';
import { customCases, teamSubmissions, userAttempts } from './storage.mjs';
import { digest, people, signIn } from './auth.mjs';
import { parseCase } from './authoring.mjs';
import { exportResults } from './analytics.mjs';

const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const roster = user => Object.values(people).filter(person => person.role === 'student' && person.group === user.group);
const examples = {
  flow: 'lesson', companyId: 'adal-market', caseId: 'cash-check',
  title: { ru: 'Проверка кассы', kk: 'Кассаны тексеру' },
  description: { ru: 'Сравните фактический и учётный остатки.', kk: 'Нақты және есептік қалдықтарды салыстырыңыз.' },
  steps: [{
    id: 'delta', skill: 'cash',
    title: { ru: 'Разница по кассе', kk: 'Касса айырмасы' },
    prompt: { ru: 'В кассе 9000 ₸, по журналу 10 000 ₸. Укажите разницу (факт минус журнал).',
      kk: 'Кассада 9000 ₸, журналда 10 000 ₸. Айырманы енгізіңіз (нақты сома минус журнал).' },
    fields: [{ id: 'amount', kind: 'number', label: { ru: 'Разница, ₸', kk: 'Айырма, ₸' } }],
    key: { amount: -1000 },
    hint: { ru: 'Сначала возьмите фактическую сумму.', kk: 'Алдымен нақты соманы алыңыз.' },
    explanation: { ru: '9000 − 10 000 = −1000 ₸.', kk: '9000 − 10 000 = −1000 ₸.' }
  }]
};

function guidedSchema(fields) {
  const localized = name => ({ ru: fields.get(name + '-ru'), kk: fields.get(name + '-kk') });
  const expected = fields.get('expected') ?? '';
  return JSON.stringify({
    flow: 'lesson', companyId: fields.get('companyId'), caseId: fields.get('caseId'),
    title: localized('caseTitle'), description: localized('caseDescription'),
    steps: [{
      id: 'answer', skill: fields.get('skill'), title: localized('caseTitle'), prompt: localized('casePrompt'),
      fields: [{ id: 'amount', kind: 'number', label: { ru: 'Ответ', kk: 'Жауап' } }],
      key: { amount: /^-?\d{1,12}$/.test(expected) ? Number(expected) : null },
      hint: localized('caseHint'), explanation: localized('caseExplanation')
    }]
  });
}

export async function readInvite(db, token) {
  if (!idPattern.test(token)) return null;
  const key = await digest(token);
  const row = await db.prepare('SELECT * FROM qr_invites WHERE digest = ? AND redeemed_at IS NULL AND expires > ?').bind(key, Date.now()).first();
  const person = row && people[row.username];
  return person?.role === 'student' && person.group === row.group_id ? { ...row, person } : null;
}

export async function join(request, db, token, ui, page, redirect) {
  const invite = await readInvite(db, token);
  const show = person => page('qr', ui.redeem(person), person ? 200 : 410);
  if (!invite || request.method === 'GET') return show(invite?.person);
  const time = Date.now();
  const update = await db.prepare('UPDATE qr_invites SET redeemed_at = ? WHERE digest = ? AND redeemed_at IS NULL AND expires > ?')
    .bind(time, invite.digest, time).run();
  if (!update.meta.changes) return show();
  try {
    return redirect('/', await signIn(db, request, invite.person));
  } catch (error) {
    await db.prepare('UPDATE qr_invites SET redeemed_at = NULL WHERE digest = ? AND redeemed_at = ?').bind(invite.digest, time).run();
    throw error;
  }
}

export async function platformRoute({ request, db, user, ui, lesson, page, pathname, origin, searchParams, form, redirect, error, lang }) {
  const post = request.method === 'POST';
  const teacher = user.role === 'teacher';
  const teamUsers = roster(user);
  if (pathname === '/accounts' && !post) return page('bank', lesson.plan(searchParams.get('q')?.slice(0, 80) || ''));
  if (pathname === '/' && !post) {
    const [custom, attempts] = await Promise.all([customCases(db, user.group), userAttempts(db, user)]);
    return page('city', ui.city(user, availableCases(custom), attempts));
  }
  const enterprise = pathname.match(/^\/company\/([a-z0-9-]+)$/);
  if (enterprise && !post) {
    const value = company(enterprise[1]);
    if (!value) return error('missing', 404);
    const [custom, attempts] = await Promise.all([customCases(db, user.group), userAttempts(db, user)]);
    return page('city', ui.company(value, availableCases(custom).filter(item => item.companyId === value.id),
      attempts.filter(attempt => attempt.config.companyId === value.id)));
  }
  if ((pathname === '/bank' || pathname === '/portfolio') && !post) {
    const [custom, attempts] = await Promise.all([customCases(db, user.group), userAttempts(db, user)]);
    const cases = availableCases(custom);
    return pathname === '/bank'
      ? page('bank', ui.bank(cases, attempts, searchParams.get('module') || '', searchParams.get('q')?.slice(0, 80) || ''))
      : page('portfolio', ui.studentPortfolio(user, cases, attempts));
  }

  if (pathname === '/teacher/analytics' && !post) {
    return page('analytics', ui.analytics(user, await userAttempts(db, user), teamUsers));
  }
  if (pathname === '/teacher/export' && !post) {
    const csv = exportResults(await userAttempts(db, user), people, lang);
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', 'content-disposition': 'attachment; filename="adal-results.csv"' } });
  }
  if (pathname === '/teacher/builder') {
    const cases = availableCases(await customCases(db, user.group));
    const templates = cases.filter(item => item.flow === 'lesson');
    const starter = JSON.stringify(examples, null, 2);
    if (!post) return page('builder', ui.builder(templates, searchParams.get('case'), starter,
      searchParams.get('published') === '1' ? 'published' : null, false, searchParams.get('editor') === 'advanced'));
    const fields = await form(request, 280000);
    const raw = fields?.get('editor') === 'guided' ? guidedSchema(fields) : fields?.get('schema') ?? '';
    if (raw.length > 30000 || !idPattern.test(fields?.get('request'))) return error('invalid', 400);
    const requestId = fields.get('request');
    if (await db.prepare('SELECT request_id FROM custom_cases WHERE group_id = ? AND request_id = ?').bind(user.group, requestId).first()) {
      return redirect('/teacher/builder?published=1');
    }
    const parsed = parseCase(raw);
    const base = fields.get('base');
    const reject = (message, status = 400) => page('builder', ui.builder(templates, base, raw, message, true), status);
    if (parsed.error) return reject(parsed.error);
    const config = parsed.config;
    const previous = cases.find(item => caseKey(item) === caseKey(config));
    if (previous && previous.flow !== 'lesson') return reject('protectedCase');
    if (previous && (base !== caseKey(config) || fields.get('version') !== String(previous.version))) return reject('versionConflict', 409);
    config.version = (previous?.version ?? 0) + 1;
    const saved = await db.prepare('INSERT INTO custom_cases VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(user.group, config.companyId, config.caseId, config.version, JSON.stringify(config), user.username, new Date().toISOString(), requestId).run();
    if (!saved.meta.changes && !(await db.prepare('SELECT request_id FROM custom_cases WHERE group_id = ? AND request_id = ?').bind(user.group, requestId).first())) {
      return reject('versionConflict', 409);
    }
    return redirect('/teacher/builder?published=1&case=' + encodeURIComponent(caseKey(config)));
  }
  const qrMatch = pathname.match(/^\/teacher\/qr\/([a-f0-9-]+)$/);
  if (pathname === '/teacher/qr') {
    if (!post) return page('qr', ui.qrPage(teamUsers));
    const name = (await form(request))?.get('student');
    if (!teamUsers.some(person => person.username === name)) return error('invalid', 400);
    const token = crypto.randomUUID();
    await db.prepare('DELETE FROM qr_invites WHERE expires <= ?').bind(Date.now()).run();
    await db.prepare('INSERT INTO qr_invites (digest, username, group_id, expires) VALUES (?, ?, ?, ?)')
      .bind(await digest(token), name, user.group, Date.now() + 600000).run();
    return redirect('/teacher/qr/' + token);
  }
  if (qrMatch && !post) {
    const invite = await readInvite(db, qrMatch[1]);
    if (!invite || invite.group_id !== user.group) return page('qr', ui.redeem(), 410);
    return page('qr', ui.qrPage(teamUsers, { ...invite, link: origin + '/enter/' + qrMatch[1] }));
  }
  if (pathname === '/team' || pathname === '/teacher/team') {
    if (!post) return page('teams', ui.teamPage(await teamSubmissions(db, user.group), user));
    if (teacher) return error('security', 403);
    const fields = await form(request);
    const id = fields?.get('request');
    const section = team.sections.find(item => item.id === fields?.get('section'));
    if (!idPattern.test(id) || !section) return error('invalid', 400);
    const answers = readAnswers(section.fields, fields);
    if (!answers) return error('invalid', 400);
    await db.prepare('INSERT INTO team_submissions VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING')
      .bind(id, user.group, user.username, section.id, JSON.stringify(answers), Number(matchesKey(section.key, answers)), new Date().toISOString()).run();
    return redirect('/team');
  }
  if ((pathname === '/cup' || pathname === '/teacher/cup') && !post) {
    return page('cup', ui.cupPage(user, await userAttempts(db, user, true), catalog, teamUsers));
  }
  return null;
}
