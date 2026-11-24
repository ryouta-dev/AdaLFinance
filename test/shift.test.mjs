import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import app from '../src/app.mjs';
import { balances } from '../src/shift.mjs';
import { localDatabase } from '../src/sqlite.mjs';

test('both returns, final feedback, role boundaries and concurrent retries', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(await readFile(new URL('../drizzle/0001_adal.sql', import.meta.url), 'utf8'));
  db.exec(await readFile(new URL('../drizzle/0002_platform.sql', import.meta.url), 'utf8'));
  const origin = 'http://adal.test';
  const call = (path, cookie, fields) => app.fetch(new Request(`${origin}${path}`, {
    method: fields ? 'POST' : 'GET', headers: { origin, cookie }, body: fields ? new URLSearchParams(fields) : undefined
  }), { DB: localDatabase(db) });
  const login = async (username, password) => {
    const response = await call('/login', '', { username, password });
    assert.equal(response.status, 303);
    return response.headers.get('set-cookie').split(';')[0];
  };
  let student = await login('student', 'market360');
  const teacher = await login('teacher', 'adal360');

  async function start() {
    const request = crypto.randomUUID();
    const path = '/case/adal-market/shift-close';
    const create = () => call(path, student, { request });
    const responses = await Promise.all([create(), create()]);
    assert.ok(responses.every(response => response.headers.get('location') === `/attempt/${request}`));
    return `/attempt/${request}`;
  }
  const read = path => {
    const row = db.prepare('SELECT * FROM attempts WHERE id = ?').get(path.split('/').at(-1));
    return { ...row, state: JSON.parse(row.state), config: JSON.parse(row.config) };
  };
  const fields = (path, action, extra) => ({ action, request: crypto.randomUUID(), revision: String(read(path).revision), ...extra });
  const send = (path, action, extra) => call(path, student, fields(path, action, extra));
  const checkBalance = (path, journal, cash, delta) => {
    const { config, state } = read(path);
    assert.deepEqual(balances(config, state.events), { journal, cash, delta });
    return state.events;
  };

  const clean = await start();
  checkBalance(clean, 0, 0, 0);
  assert.equal((await send(clean, 'payout')).headers.get('location'), `${clean}?error=invalid`);
  const sale = fields(clean, 'sale');
  await Promise.all([call(clean, student, sale), call(clean, student, sale), call(clean, student, { ...sale, request: crypto.randomUUID() })]);
  assert.equal(checkBalance(clean, 52400, 52400, 0).filter(event => event.kind === 'sale').length, 1);
  await send(clean, 'payout');
  await send(clean, 'record');
  checkBalance(clean, 48900, 48900, 0);
  await send(clean, 'confirm');
  await send(clean, 'check', { debit: '1010', credit: '6010', amount: '52400' });
  await send(clean, 'next');
  await send(clean, 'finish');
  assert.match(await (await call(clean, student)).text(), /Сразу верно/);

  const attempt = await start();
  await send(attempt, 'sale');
  const payout = fields(attempt, 'payout');
  await Promise.all([call(attempt, student, payout), call(attempt, student, payout)]);
  await send(attempt, 'skip');
  checkBalance(attempt, 52400, 48900, -3500);
  assert.equal((await send(attempt, 'confirm')).headers.get('location'), `${attempt}?error=invalid`);
  await send(attempt, 'hint');
  await send(attempt, 'correct', { cause: 'counting' });
  checkBalance(attempt, 52400, 48900, -3500);
  const correction = fields(attempt, 'correct', { cause: 'missing-refund' });
  await Promise.all([call(attempt, student, correction), call(attempt, student, correction)]);
  const events = checkBalance(attempt, 48900, 48900, 0);
  assert.deepEqual(events.find(event => event.kind === 'skip').balance, { journal: 52400, cash: 48900, delta: -3500 });
  assert.equal(events.filter(event => event.kind === 'payout').length, 1);
  assert.equal(events.filter(event => event.kind === 'correction').length, 1);
  const logout = await call('/logout', student, {});
  assert.equal(logout.status, 303);
  assert.equal((await call(attempt, student)).headers.get('location'), '/login');
  student = await login('student', 'market360');
  assert.match(await (await call(attempt, `${student}; adal_lang=kk`)).text(), /Кассаны салыстыру/);
  await send(attempt, 'confirm');
  await send(attempt, 'check', { debit: '1030', credit: '6010', amount: '52400' });
  assert.match(await (await call(attempt, student)).text(), /Ответ расходится с ключом/);
  await send(attempt, 'check', { debit: '1010', credit: '6010', amount: '52400' });
  assert.match(await (await call(attempt, student)).text(), /Ответ верный/);
  await send(attempt, 'next');
  await send(attempt, 'finish');

  assert.equal((await call('/teacher', student)).status, 403);
  assert.equal((await call(`/teacher${attempt}`, student)).status, 403);
  const other = crypto.randomUUID();
  db.prepare(`INSERT INTO attempts SELECT ?, 'other', 'БУ-22', config, state, revision, started_at, finished_at
    FROM attempts WHERE id = ?`).run(other, attempt.split('/').at(-1));
  assert.equal((await call(`/attempt/${other}`, student)).status, 404);
  assert.equal((await call(`/teacher/attempt/${other}`, teacher)).status, 404);
  const history = await (await call(`/teacher${attempt}`, teacher)).text();
  assert.ok(history.indexOf('Запись возврата пропущена') < history.indexOf('Пропущенный возврат внесён'));
  for (const phrase of ['Повторной выдачи наличных не было', '−3 500 ₸', 'Исправлено', 'Открыта подсказка', 'Неверно', 'Верно']) assert.ok(history.includes(phrase));
  const cabinet = await (await call('/teacher', teacher)).text();
  assert.ok(cabinet.includes(`/teacher${clean}`) && cabinet.includes(`/teacher${attempt}`));
  assert.ok(!cabinet.includes(other));
  db.close();
});
