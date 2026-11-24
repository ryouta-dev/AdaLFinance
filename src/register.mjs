import { balances, registerReport } from './shift.mjs';

export const openRegister = (request, at) => ({ step: 'register', events: [{ kind: 'open', request, at }] });
const integer = text => typeof text === 'string' && /^\d{1,12}$/.test(text) ? Number(text) : null;
const draft = (items, fields) => items.map(item => ({
  id: item.id,
  quantity: integer(fields.get('qty-' + item.id) || '0')
}));

export function availableItems(sale, events) {
  return sale.lines.map(line => ({
    ...line,
    quantity: line.quantity - events.filter(event => event.kind === 'refund' && event.original === sale.receipt)
      .reduce((sum, event) => sum + (event.lines.find(item => item.id === line.id)?.quantity ?? 0), 0)
  }));
}

export function applyRegister(config, state, action, fields, request, at) {
  if (state.step !== 'register') return null;
  const events = state.events;
  const sales = events.filter(event => event.kind === 'sale');
  const refunds = events.filter(event => event.kind === 'refund');
  let event;
  if (action === 'sell' && sales.length < 75) {
    const entries = draft(config.items, fields);
    if (entries.some(item => item.quantity === null || item.quantity > 99)) return { invalid: 'basketError' };
    const lines = entries.filter(item => item.quantity > 0).map(item => ({ ...item, unit: config.items.find(product => product.id === item.id).amount }));
    if (!lines.length) return { invalid: 'basketError' };
    const amount = lines.reduce((sum, item) => sum + item.unit * item.quantity, 0);
    const tender = integer(fields.get('tender'));
    const change = integer(fields.get('change'));
    if (tender === null || tender < amount || change === null) return { invalid: 'tenderError' };
    if (tender - amount !== change) {
      event = { kind: 'changeError', amount, tender, change };
    } else {
      event = { kind: 'sale', amount, tender, change, lines, receipt: 'S-' + (sales.length + 1) };
    }
  } else if (action === 'return') {
    const sale = sales.find(item => item.receipt === fields.get('receipt'));
    if (!sale) return { invalid: 'returnError' };
    const stock = availableItems(sale, events);
    const entries = draft(stock, fields);
    if (entries.some(item => item.quantity === null || item.quantity > stock.find(product => product.id === item.id).quantity)) {
      return { invalid: 'returnError' };
    }
    const lines = entries.filter(item => item.quantity > 0).map(item => ({ ...item, unit: stock.find(product => product.id === item.id).unit }));
    if (!lines.length) return { invalid: 'returnError' };
    const amount = lines.reduce((sum, item) => sum + item.unit * item.quantity, 0);
    event = { kind: 'refund', amount, lines, original: sale.receipt, receipt: 'R-' + (refunds.length + 1) };
  } else if (action === 'reportX' || action === 'finish') {
    event = { kind: action, report: practiceReport(config, events), sales: sales.length, refunds: refunds.length };
  } else {
    return null;
  }
  return { step: action === 'finish' ? 'done' : 'register', events: [...events, { ...event, request, at }] };
}

export function practiceBalances(config, events) {
  const cashEvents = events.flatMap(event => event.kind === 'refund' ? [{ ...event, kind: 'payout' }, event] : [event]);
  return balances(config, cashEvents);
}

export function practiceReport(config, events) {
  return { ...registerReport(config, events), ...practiceBalances(config, events) };
}
