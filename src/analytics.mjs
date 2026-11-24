import { caseKey, ranks, skills } from '../content/academy.mjs';
import { lessonResults } from './lesson.mjs';
import { statuses } from './shift.mjs';

const shiftSkills = { sale: 'cash', refund: 'cash', reconcile: 'cash', posting: 'accounting' };
export const cupCases = ['adal-cafe/cafe-register', 'adal-factory/production-ledger', 'adal-logistics/vat-review'];
export const points = { right: 2, fixed: 1, error: 0, pending: 0 };

export function evidence(attempt) {
  if (attempt.config.flow === 'lesson') return lessonResults(attempt.config, attempt.state)
    .map(row => ({ skill: row.task.skill, title: row.task.title, status: row.status }));
  if (attempt.config.flow === 'register') {
    const events = attempt.state.events;
    const counts = events.reduce((counter, event) => ({ ...counter, [event.kind]: (counter[event.kind] ?? 0) + 1 }), {});
    return [
      { skill: 'cash', title: attempt.config.documents.sale, status: counts.sale ? counts.changeError ? 'fixed' : 'right' : counts.changeError ? 'error' : 'pending' },
      { skill: 'cash', title: attempt.config.documents.refund, status: counts.refund ? 'right' : 'pending' },
      { skill: 'cash', title: attempt.config.documents.z, status: counts.finish ? 'right' : 'pending' }
    ];
  }
  const results = statuses(attempt.state);
  return Object.entries(shiftSkills).map(([key, skill]) => ({ skill, title: attempt.config.steps[key].title, status: results[key] }));
}

function score(attempt) {
  const results = evidence(attempt);
  const earned = results.reduce((sum, row) => sum + points[row.status], 0);
  return { earned, maximum: results.length * 2, verified: results.every(row => points[row.status] > 0) };
}

export function portfolio(attempts) {
  const completed = attempts.filter(item => item.finished_at && !item.state.cup);
  const best = new Map();
  const diagnosis = completed.find(item => item.config.diagnostic);
  for (const attempt of completed) {
    if (attempt.config.diagnostic || attempt.config.flow === 'register') continue;
    const key = caseKey(attempt.config);
    const result = score(attempt);
    if (!best.has(key) || result.earned > best.get(key).score.earned) best.set(key, { attempt, score: result });
  }
  const records = [...best.values()];
  const verified = records.filter(row => row.score.verified).length;
  const values = Object.fromEntries(Object.keys(skills).map(skill => [skill, { earned: 0, maximum: 0, cases: [] }]));
  for (const { attempt } of records) {
    for (const row of evidence(attempt)) {
      const entry = values[row.skill];
      entry.earned += points[row.status];
      entry.maximum += 2;
      if (!entry.cases.includes(attempt)) entry.cases.push(attempt);
    }
  }
  const earned = records.reduce((sum, row) => sum + row.score.earned, 0);
  const maximum = records.reduce((sum, row) => sum + row.score.maximum, 0);
  return {
    records, verified, diagnosis, values,
    baseline: diagnosis ? Object.groupBy(evidence(diagnosis), item => item.skill) : {},
    rank: ranks.findLast(rank => verified >= rank.threshold),
    nextRank: ranks.find(rank => verified < rank.threshold),
    salary: records.reduce((sum, row) => sum + (row.score.verified ? 12000 + row.score.earned * 250 : 0), 0),
    reputation: maximum ? Math.round(earned * 100 / maximum) : 0
  };
}

export function standings(attempts, roster) {
  return roster.map(user => {
    const rounds = cupCases.map(key => attempts.filter(item => item.owner === user.username && item.state.cup && caseKey(item.config) === key)
      .sort((a, b) => a.started_at.localeCompare(b.started_at))[0]);
    const completed = rounds.filter(item => item?.finished_at);
    const earned = completed.reduce((sum, item) => sum + score(item).earned, 0);
    const time = completed.reduce((sum, item) => sum + Math.max(0, Date.parse(item.finished_at) - Date.parse(item.started_at)), 0);
    return { user, rounds, earned, completed: completed.length, time };
  }).sort((a, b) => b.earned - a.earned || b.completed - a.completed || a.time - b.time || a.user.name.localeCompare(b.user.name));
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+@-]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function exportResults(attempts, people, lang) {
  const header = lang === 'kk' ? ['Студент', 'Кәсіпорын', 'Кейс', 'Нұсқа', 'Дағды', 'Тапсырма', 'Күй', 'Ұпай', 'Басталуы', 'Аяқталуы'] :
    ['Студент', 'Предприятие', 'Кейс', 'Версия', 'Навык', 'Задание', 'Статус', 'Баллы', 'Начало', 'Завершение'];
  const status = lang === 'kk' ? { right: 'Бірден дұрыс', fixed: 'Түзетілді', error: 'Қате бар', pending: 'Күтілуде' } :
    { right: 'Сразу верно', fixed: 'Исправлено', error: 'Есть ошибка', pending: 'Ожидается' };
  const rows = attempts.flatMap(attempt => evidence(attempt).map(row => [
    people[attempt.owner]?.name ?? attempt.owner, attempt.config.company, attempt.config.title[lang],
    attempt.config.version, skills[row.skill][lang], row.title[lang], status[row.status], points[row.status],
    attempt.started_at, attempt.finished_at
  ]));
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
