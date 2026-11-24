export const steps = ['open', 'sale', 'refund', 'reconcile', 'posting', 'finish'];

export function totals(config) {
  const item = config.items.find(item => item.id === config.returnItem);
  return { sale: config.items.reduce((sum, item) => sum + item.amount, 0), refund: item.amount, item };
}

export function balances(config, events) {
  let journal = config.opening;
  let cash = config.opening;
  for (const event of events) {
    if (event.kind === 'sale') { journal += event.amount; cash += event.amount; }
    if (event.kind === 'payout') cash -= event.amount;
    if (event.kind === 'refund' || event.kind === 'correction') journal -= event.amount;
  }
  return { journal, cash, delta: cash - journal };
}

export function openShift(request, at, cup = false) {
  return { step: 'sale', ...(cup ? { cup } : {}), events: [{ kind: 'open', step: 'open', request, at }] };
}

export function registerReport(config, events) {
  const sum = kinds => events.filter(event => kinds.includes(event.kind)).reduce((total, event) => total + event.amount, 0);
  return { opening: config.opening, sales: sum(['sale']), refunds: sum(['refund', 'correction']), ...balances(config, events) };
}

export function applyAction(config, state, action, fields, request, at) {
  const { step, events } = state;
  const has = kind => events.some(event => event.kind === kind);
  const { sale, refund } = totals(config);
  const current = balances(config, events);
  let next = step;
  let event;

  if (action === 'hint' && !state.cup && config.steps[step]?.hint) {
    if (events.some(event => event.kind === 'hint' && event.step === step)) return state;
    event = { kind: 'hint' };
  } else if (step === 'sale' && action === 'sale') {
    if (config.register) {
      const raw = fields.get('change') ?? '';
      if (!/^\d{1,12}$/.test(raw)) return null;
      const change = Number(raw);
      const tender = config.register.tender;
      if (change !== tender - sale) {
        event = { kind: 'changeError', change };
      } else {
        event = { kind: 'sale', amount: sale, tender, change };
        next = 'refund';
      }
    } else {
      event = { kind: 'sale', amount: sale };
      next = 'refund';
    }
  } else if (step === 'refund' && action === 'payout' && !has('payout')) {
    event = { kind: 'payout', amount: refund };
  } else if (step === 'refund' && has('payout') && ['record', 'skip'].includes(action)) {
    event = action === 'record' ? { kind: 'refund', amount: refund } : { kind: 'skip' };
    next = 'reconcile';
  } else if (step === 'reconcile' && action === 'correct' && current.delta !== 0 && has('skip') && !has('correction')) {
    const cause = fields.get('cause');
    if (!config.causes.some(option => option.id === cause)) return null;
    event = cause === config.keys.cause
      ? { kind: 'correction', cause, amount: refund, before: current }
      : { kind: 'causeError', cause };
  } else if (step === 'reconcile' && action === 'confirm' && current.delta === 0) {
    event = { kind: 'confirm', balance: current };
    next = 'posting';
  } else if (step === 'posting' && action === 'check') {
    const debit = fields.get('debit');
    const credit = fields.get('credit');
    const raw = fields.get('amount') ?? '';
    const amount = Number(raw);
    if (!/^\d{1,12}$/.test(raw) || !config.accounts.some(item => item.code === debit)
      || !config.accounts.some(item => item.code === credit)) return null;
    const key = config.keys.posting;
    event = { kind: 'check', debit, credit, amount, correct: debit === key.debit && credit === key.credit && amount === key.amount };
  } else if (step === 'posting' && action === 'next' && has('check')) {
    event = { kind: 'next' };
    next = 'finish';
  } else if (action === 'reportX' && config.register && ['reconcile', 'posting', 'finish'].includes(step)) {
    event = { kind: 'reportX', report: registerReport(config, events) };
  } else if (step === 'finish' && action === 'finish') {
    event = config.register ? { kind: 'finish', report: registerReport(config, events) } : { kind: 'finish' };
    next = 'done';
  } else {
    return null;
  }

  if (['refund', 'skip', 'correction'].includes(event.kind)) {
    event.balance = balances(config, [...events, event]);
  }
  return { ...state, step: next, events: [...events, { ...event, step, request, at }] };
}

export function statuses({ events }) {
  const has = kind => events.some(event => event.kind === kind);
  const answers = events.filter(event => event.kind === 'check');
  const last = answers.at(-1);
  const refund = has('correction') ? 'fixed' : has('skip') ? 'error' : has('refund') ? 'right' : 'pending';
  return {
    open: has('open') ? 'right' : 'pending',
    sale: has('sale') ? has('changeError') ? 'fixed' : 'right' : has('changeError') ? 'error' : 'pending', refund,
    reconcile: refund === 'error' ? 'error' : has('confirm') ? refund : 'pending',
    posting: last ? last.correct ? answers.some(answer => !answer.correct) ? 'fixed' : 'right' : 'error' : 'pending',
    finish: has('finish') ? 'right' : 'pending'
  };
}
