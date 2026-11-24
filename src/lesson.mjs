import { accountByCode } from '../content/accounts.mjs';
import { mentorReply, personas } from './mentor.mjs';

export const openLesson = (request, at, cup = false) => ({ step: 'lesson', index: 0, cup, events: [{ kind: 'open', request, at }] });

export function readAnswers(fields, submitted, allowedAccounts) {
  const answers = {};
  for (const field of fields) {
    const raw = submitted.get('answer-' + field.id);
    if (typeof raw !== 'string') return null;
    if (field.kind === 'number') {
      if (!/^-?[0-9]{1,12}$/.test(raw)) return null;
      answers[field.id] = Number(raw);
    } else if (field.kind === 'choice' && field.options.some(item => item.id === raw)) {
      answers[field.id] = raw;
    } else if (field.kind === 'account' && Object.hasOwn(accountByCode, raw) && (!allowedAccounts || allowedAccounts.includes(raw))) {
      answers[field.id] = raw;
    } else {
      return null;
    }
  }
  return answers;
}

export const matchesKey = (key, answers) => Object.entries(key).every(([field, value]) => answers[field] === value);

export async function applyLesson(config, state, action, fields, request, at, env, lang) {
  if (state.step === 'done') return null;
  const task = config.steps[state.index];
  const events = state.events.filter(event => event.index === state.index);
  const answers = events.filter(event => event.kind === 'answer');
  let event;
  let index = state.index;
  if (action === 'answer' && task && answers.length < 12 && !answers.some(event => event.correct) && (!config.diagnostic || !answers.length)) {
    const answer = readAnswers(task.fields, fields, config.accounts);
    if (!answer) return null;
    event = { kind: 'answer', answers: answer, correct: matchesKey(task.key, answer) };
  } else if (action === 'next' && task && answers.length) {
    event = { kind: 'next' };
    index += 1;
  } else if (action === 'hint' && task && !state.cup && !config.diagnostic) {
    if (events.some(event => event.kind === 'hint')) return state;
    event = { kind: 'hint' };
  } else if (action === 'mentor' && task && !state.cup && !config.diagnostic) {
    const persona = fields.get('persona');
    const question = fields.get('question')?.trim();
    if (!Object.hasOwn(personas, persona) || !question || question.length > 450
      || state.events.filter(event => event.kind === 'mentor').length >= 16) return null;
    event = { kind: 'mentor', persona, question, lang, ...await mentorReply(env, config, task, persona, question, lang) };
  } else if (action === 'finish' && !task) {
    event = { kind: 'finish' };
  } else {
    return null;
  }
  const recorded = { ...event, index: state.index, request, at };
  return { ...state, index, step: action === 'finish' ? 'done' : 'lesson', events: [...state.events, recorded] };
}

export function lessonResults(config, state) {
  return config.steps.map((task, index) => {
    const attempts = state.events.filter(event => event.kind === 'answer' && event.index === index);
    const first = attempts[0];
    const last = attempts.at(-1);
    const status = !last ? 'pending' : first.correct ? 'right' : last.correct ? 'fixed' : 'error';
    return { task, status, first, last, attempts };
  });
}

export function lessonPostings(config, state) {
  return lessonResults(config, state).filter(row => row.task.post && row.last?.correct)
    .map(row => ({ ...row.last.answers, doc: row.task.post }));
}
