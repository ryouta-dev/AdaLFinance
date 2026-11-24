import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import app from '../src/app.mjs';
import { localDatabase } from '../src/sqlite.mjs';
import { enterprises } from '../content/academy.mjs';
import { officialAccountNames } from '../content/official-account-names.mjs';
import { latestCase } from '../content/catalog.mjs';
import { financialStatements, trialBalance, trialTotals, vatSummary } from '../src/reports.mjs';
import { lessonPostings, lessonResults } from '../src/lesson.mjs';
import { parseCase } from '../src/authoring.mjs';
import { practiceBalances } from '../src/register.mjs';

async function simulator(t) {
  const db = new DatabaseSync(':memory:');
  for (const name of ['0001_adal.sql', '0002_platform.sql']) {
    db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
  }
  t.after(() => db.close());
  const origin = 'https://adal.test';
  const env = { DB: localDatabase(db) };
  const request = (path, cookie, fields) => app.fetch(new Request(origin + path, {
    method: fields ? 'POST' : 'GET',
    headers: { origin, cookie: cookie ?? '' },
    body: fields ? new URLSearchParams(fields) : undefined
  }), env);
  const read = path => {
    const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(path.split('/').at(-1));
    return { ...row, config: JSON.parse(row.config), state: JSON.parse(row.state) };
  };
  const start = async (slug, cookie, cup = false) => {
    const response = await request('/case/' + slug + (cup ? '?cup=1' : ''), cookie, { request: crypto.randomUUID() });
    assert.equal(response.status, 303);
    return response.headers.get('location');
  };
  const answerFields = data => Object.fromEntries(Object.entries(data).map(([key, value]) => ['answer-' + key, value]));
  const actionFields = (path, action, fields) => ({
    action, request: crypto.randomUUID(), revision: read(path).revision, ...(action === 'answer' ? answerFields(fields) : fields)
  });
  const act = async (path, cookie, action, fields) => {
    const response = await request(path, cookie, actionFields(path, action, fields));
    assert.equal(response.headers.get('location'), path);
    return read(path);
  };
  const cookieFrom = response => response.headers.get('set-cookie')?.split(';')[0];
  const login = async (username, password) => {
    const response = await request('/login', '', { username, password });
    assert.equal(response.status, 303);
    return cookieFrom(response);
  };
  const complete = async (path, cookie) => {
    let row = read(path);
    for (const step of row.config.steps.slice(row.state.index)) {
      if (!lessonResults(row.config, row.state)[row.state.index].last?.correct) await act(path, cookie, 'answer', step.key);
      row = await act(path, cookie, 'next');
    }
    return act(path, cookie, 'finish');
  };
  return { db, env, read, login, start, act, request, actionFields, answerFields, cookieFrom, complete };
}

test('seven workplaces, both languages, diagnostic and domain artifacts', async t => {
  const sim = await simulator(t);
  const student = await sim.login('student', 'market360');
  const teacher = await sim.login('teacher', 'adal360');
  const city = await sim.request('/', student);
  assert.equal(city.status, 200);
  const directory = await city.text();
  for (const enterprise of enterprises) assert.ok(directory.includes('/company/' + enterprise.id));
  const kk = await (await sim.request('/bank?module=tax', student + '; adal_lang=kk')).text();
  assert.match(kk, /Декларация және камералдық салыстыру/);
  assert.doesNotMatch(kk, /Партия материалов/);
  assert.equal(officialAccountNames.length, 275);
  assert.match(await (await sim.request('/accounts?q=8410', student + '; adal_lang=kk')).text(), /8410/);

  const factory = await sim.start('adal-factory/production-ledger', student);
  await sim.act(factory, student, 'answer', { debit: '3310', credit: '1310', amount: 72000 });
  assert.equal(lessonPostings(sim.read(factory).config, sim.read(factory).state).length, 0);
  await sim.act(factory, student, 'hint');
  await sim.act(factory, student, 'mentor', { persona: 'accountant', question: 'Как проверить сумму проводки?' });
  const completed = await sim.complete(factory, student);
  const postings = lessonPostings(completed.config, completed.state);
  const totals = trialTotals(trialBalance(completed.config.opening, postings));
  assert.deepEqual([postings.length, totals.debit, totals.credit, totals.closingDebit, totals.closingCredit],
    [3, 169000, 169000, 242000, 242000]);
  assert.equal(lessonResults(completed.config, completed.state)[0].status, 'fixed');
  const teacherView = await (await sim.request('/teacher' + factory, teacher)).text();
  for (const piece of ['Вопрос наставнику', 'Первый ответ', 'Оборотно-сальдовая ведомость', '169 000 ₸', 'Исправлено']) assert.ok(teacherView.includes(piece));

  const builds = new Set();
  for (let index = 0; index < 12 && builds.size < 2; index += 1) {
    const path = await sim.start('adal-build/project-report', student);
    const { config } = sim.read(path);
    builds.add(config.ledger[2].amount);
    const report = financialStatements(trialBalance(config.opening, config.ledger));
    assert.equal(report.difference, 0);
    assert.equal(report.profit, 117000 - config.ledger[2].amount);
    assert.equal(sim.read(path).config.ledger[2].amount, config.ledger[2].amount);
    if (index === 0) {
      await sim.complete(path, student);
      assert.match(await (await sim.request(path, student)).text(), /Отчёт о финансовом положении/);
    }
  }
  assert.ok([...builds].every(value => [8000, 14000].includes(value)));

  for (const [slug, artifact] of [
    ['adal-logistics/vat-review', 'Исправленная декларация'],
    ['adal-bank/bank-reconciliation', '215 200 ₸'],
    ['adal-advisory/duplicate-invoice', 'Заключение по проверке'],
    ['adal-advisory/professional-ethics', 'Служебная запись'],
    ['academy/entry-diagnostic', 'Доказательство операции']
  ]) {
    const path = await sim.start(slug, student);
    const result = await sim.complete(path, student);
    assert.ok(result.finished_at);
    assert.ok(lessonResults(result.config, result.state).every(row => row.status === 'right'));
    assert.ok((await (await sim.request(path, student)).text()).includes(artifact), slug);
  }
  const tax = latestCase('adal-logistics', 'vat-review').taxInputs;
  assert.deepEqual(vatSummary(tax), { salesBase: 500000, outputVat: 80000, inputVat: 32000, payable: 48000 });
  assert.equal((await sim.request('/teacher/analytics', student)).status, 403);
  const csv = await sim.request('/teacher/export', teacher);
  assert.match(csv.headers.get('content-type'), /^text\/csv/);
  const exported = await csv.text();
  assert.match(exported, /"Партия материалов"/);
  assert.match(exported, /"Исправлено"/);
  const portfolio = await (await sim.request('/portfolio', student)).text();
  assert.match(portfolio, /Карта компетенций/);
  assert.match(portfolio, /Старший специалист/);
  assert.match(portfolio, /Открыть результат диагностики/);
  assert.match(portfolio, /79 250 ₸/);
});

test('café change, X/Z reports and a single attempt for each Cup round', async t => {
  const sim = await simulator(t);
  const student = await sim.login('student', 'market360');
  const cafeSlug = 'adal-cafe/cafe-register';
  const first = await sim.start(cafeSlug, student, true);
  assert.equal(await sim.start(cafeSlug, student, true), first);
  assert.equal((await sim.request('/case/' + cafeSlug + '?cup=1', student)).headers.get('location'), first);
  const wrong = await sim.act(first, student, 'sale', { change: 850 });
  assert.equal(wrong.state.step, 'sale');
  assert.equal(wrong.state.events.filter(item => item.kind === 'sale').length, 0);
  await sim.act(first, student, 'sale', { change: 1250 });
  await sim.act(first, student, 'payout');
  await sim.act(first, student, 'skip');
  await sim.act(first, student, 'reportX');
  assert.equal(sim.read(first).state.events.find(item => item.kind === 'reportX').report.delta, -2650);
  await sim.act(first, student, 'correct', { cause: 'missing-refund' });
  await sim.act(first, student, 'confirm');
  await sim.act(first, student, 'check', { debit: '1010', credit: '6010', amount: 8750 });
  await sim.act(first, student, 'next');
  const final = await sim.act(first, student, 'finish');
  assert.deepEqual(final.state.events.at(-1).report, { opening: 10000, sales: 8750, refunds: 2650, cash: 16100, journal: 16100, delta: 0 });
  const output = await (await sim.request(first, student)).text();
  assert.match(output, /X-отчёт/);
  assert.match(output, /Z-отчёт/);
  for (const slug of ['adal-factory/production-ledger', 'adal-logistics/vat-review']) {
    await sim.complete(await sim.start(slug, student, true), student);
  }
  assert.match(await (await sim.request('/cup', student)).text(), /3 \/ 3/);
});

test('group authoring with snapshots, QR redemption, team collaboration and mentor fallback', async t => {
  const sim = await simulator(t);
  const student = await sim.login('student', 'market360');
  const teacher = await sim.login('teacher', 'adal360');
  const source = latestCase('adal-advisory', 'professional-ethics');
  assert.ok(parseCase(JSON.stringify(source)).config);
  assert.equal(parseCase(JSON.stringify({ ...source, steps: [{ ...source.steps[0], key: { response: 'missing' } }] })).error, 'caseSchemaError');
  const oldAttempt = await sim.start('adal-advisory/professional-ethics', student);
  const schema = { ...source, title: { ru: 'Версия преподавателя', kk: 'Оқытушы нұсқасы' } };
  const publish = { base: 'adal-advisory/professional-ethics', version: 1, request: crypto.randomUUID(), schema: JSON.stringify(schema) };
  const copies = await Promise.all([sim.request('/teacher/builder', teacher, publish), sim.request('/teacher/builder', teacher, publish)]);
  assert.ok(copies.every(item => item.status === 303));
  assert.equal((await sim.request('/teacher/builder', teacher, { ...publish, request: crypto.randomUUID() })).status, 409);
  assert.equal((await sim.request('/teacher/builder', student, publish)).status, 403);
  const newAttempt = await sim.start('adal-advisory/professional-ethics', student);
  assert.equal(sim.read(oldAttempt).config.version, 1);
  assert.equal(sim.read(newAttempt).config.version, 2);
  assert.equal(sim.read(newAttempt).config.title.ru, 'Версия преподавателя');
  const simple = { editor: 'guided', request: crypto.randomUUID(), companyId: 'adal-market', caseId: 'opening-money', skill: 'cash', expected: 2000 };
  for (const field of ['caseTitle', 'caseDescription', 'casePrompt', 'caseHint', 'caseExplanation']) {
    simple[field + '-ru'] = 'Пример запуска кассы';
    simple[field + '-kk'] = 'Кассаны іске қосу мысалы';
  }
  assert.equal((await sim.request('/teacher/builder', teacher, simple)).status, 303);
  const guidedAttempt = await sim.start('adal-market/opening-money', student);
  assert.equal(sim.read(guidedAttempt).config.steps[0].key.amount, 2000);
  const mode = await sim.act(oldAttempt, student + '; adal_lang=kk', 'mentor', { persona: 'controller', question: 'Қандай құжатты қарау керек?' });
  assert.equal(mode.state.events.at(-1).mode, 'builtIn');
  assert.equal(mode.state.events.at(-1).lang, 'kk');
  assert.match(mode.state.events.at(-1).answer, /Салыстыр|салыстыр/);

  const invite = await sim.request('/teacher/qr', teacher, { student: 'student2' });
  assert.equal(invite.status, 303);
  const teacherQR = invite.headers.get('location');
  const codePage = await (await sim.request(teacherQR, teacher)).text();
  assert.match(codePage, /<svg/);
  const redeem = teacherQR.replace('/teacher/qr/', '/enter/');
  const redeemed = await Promise.all([sim.request(redeem, '', {}), sim.request(redeem, '', {})]);
  assert.deepEqual(redeemed.map(response => response.status).sort(), [303, 410]);
  const second = sim.cookieFrom(redeemed.find(response => response.status === 303));
  assert.match(await (await sim.request('/', second)).text(), /Әли Нұрлан/);
  assert.equal((await sim.request('/teacher/qr', second)).status, 403);
  assert.equal((await sim.request(oldAttempt, second)).status, 404);

  for (const [session, section, answers] of [
    [student, 'inventory', { units: 2 }], [second, 'valuation', { amount: 7000 }], [student, 'review', { evidence: 'records' }]
  ]) {
    const data = { request: crypto.randomUUID(), section, ...sim.answerFields(answers) };
    await Promise.all([sim.request('/team', session, data), sim.request('/team', session, data)]);
  }
  assert.equal(sim.db.prepare('SELECT COUNT(*) AS count FROM team_submissions').get().count, 3);
  const groupTeam = await (await sim.request('/teacher/team', teacher)).text();
  assert.match(groupTeam, /Акт готов к разбору/);
  assert.match(groupTeam, /Әли Нұрлан/);
  assert.match(groupTeam, /Аружан Сейіт/);
});

test('free cash desk keeps each original receipt, pays each return once and snapshots X/Z', async t => {
  const sim = await simulator(t);
  const student = await sim.login('student', 'market360');
  const path = await sim.start('adal-cafe/practice-register', student);
  const send = (action, data) => sim.request(path, student, sim.actionFields(path, action, data));
  assert.match((await send('sell', { tender: 5000, change: 1000 })).headers.get('location'), /basketError$/);
  await sim.act(path, student, 'sell', { 'qty-coffee': 2, 'qty-croissant': 1, tender: 5000, change: 1200 });
  assert.equal(sim.read(path).state.events.at(-1).kind, 'changeError');
  await sim.act(path, student, 'sell', { 'qty-coffee': 2, 'qty-croissant': 1, tender: 5000, change: 1150 });
  await sim.act(path, student, 'sell', { 'qty-beans': 1, tender: 5000, change: 500 });
  await sim.act(path, student, 'reportX');
  const one = sim.actionFields(path, 'return', { receipt: 'S-1', 'qty-coffee': 1 });
  await Promise.all([sim.request(path, student, one), sim.request(path, student, one)]);
  assert.match((await send('return', { receipt: 'S-1', 'qty-coffee': 2 })).headers.get('location'), /returnError$/);
  await sim.act(path, student, 'return', { receipt: 'S-2', 'qty-beans': 1 });
  let { config, state } = sim.read(path);
  assert.deepEqual(practiceBalances(config, state.events), { journal: 10000, cash: 10000, delta: 0 });
  assert.equal(state.events.find(event => event.kind === 'reportX').report.cash, 15850);
  assert.deepEqual(state.events.filter(event => event.kind === 'refund').map(event => [event.original, event.amount]), [['S-1', 1350], ['S-2', 4500]]);
  await sim.act(path, student, 'finish');
  ({ state } = sim.read(path));
  assert.deepEqual(state.events.at(-1).report, { opening: 7500, sales: 8350, refunds: 5850, journal: 10000, cash: 10000, delta: 0 });
  assert.match((await send('sell', { 'qty-beans': 1, tender: 5000, change: 500 })).headers.get('location'), /invalid$/);
});

test('the connected mentor only receives task context and never determines a grade', async t => {
  const sim = await simulator(t);
  const student = await sim.login('student', 'market360');
  const path = await sim.start('adal-advisory/duplicate-invoice', student);
  sim.env.OPENAI_API_KEY = 'test-only';
  sim.env.OPENAI_MODEL = 'test-model';
  const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    const context = JSON.parse(body.input);
    assert.ok(context.task.includes('банковский реестр'));
    assert.equal(context.studentQuestion, 'Где найти доказательство?');
    assert.ok(!body.input.includes('Аружан') && !body.input.includes(path) && !body.input.includes('"key"'));
    return Response.json({ output: [{ content: [{ type: 'output_text', text: 'Сверьте назначение обоих платежей.' }] }] });
  });
  await sim.act(path, student, 'mentor', { persona: 'auditor', question: 'Где найти доказательство?' });
  assert.equal(mock.mock.callCount(), 1);
  const { config, state } = sim.read(path);
  assert.equal(state.events.at(-1).mode, 'model');
  assert.equal(lessonResults(config, state)[0].status, 'pending');
});

test('public role buttons keep visitors in separate demo workspaces and QR joins the intended workspace', async t => {
  const sim = await simulator(t);
  assert.equal((await sim.request('/login', '', { profile: 'student' })).status, 401);
  sim.env.PUBLIC_DEMO = '1';
  const cookies = response => Object.fromEntries(response.headers.getSetCookie()
    .map(value => value.split(';')[0]).map(value => value.split('=')));
  const browser = data => Object.entries(data).map(([key, value]) => key + '=' + value).join('; ');
  const profile = async (role, existing) => {
    const response = await sim.request('/login', browser(existing ?? {}), { profile: role });
    assert.equal(response.status, 303);
    return cookies(response);
  };
  const first = await profile('student');
  const outsider = await profile('student');
  assert.ok(first.adal_demo);
  assert.notEqual(first.adal_demo, outsider.adal_demo);
  const attempt = await sim.start('adal-market/shift-close', browser(first));
  assert.equal((await sim.request(attempt, browser(outsider))).status, 404);
  assert.equal((await sim.request(attempt, browser({ ...first, adal_demo: outsider.adal_demo }))).status, 200);
  await sim.request('/logout', browser(first), {});
  const teacher = await profile('teacher', { adal_demo: first.adal_demo });
  const teacherHome = await (await sim.request('/teacher', browser(teacher))).text();
  assert.ok(teacherHome.includes('/teacher' + attempt));
  assert.ok(!teacherHome.includes(first.adal_demo));
  const anotherTeacher = await profile('teacher', { adal_demo: outsider.adal_demo });
  assert.equal((await sim.request('/teacher' + attempt, browser(anotherTeacher))).status, 404);
  const qr = await sim.request('/teacher/qr', browser(teacher), { student: 'student2' });
  assert.equal(qr.status, 303);
  const visitor = await sim.request(qr.headers.get('location').replace('/teacher/qr/', '/enter/'), '', {});
  assert.equal(visitor.status, 303);
  assert.equal(cookies(visitor).adal_demo, first.adal_demo);
});
