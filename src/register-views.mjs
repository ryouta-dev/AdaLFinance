import { availableItems, practiceBalances } from './register.mjs';
import { date, escape, money } from './views.mjs';
import { platformText } from './lesson-views.mjs';
import { people } from './auth.mjs';

export function registerViews(lang, base) {
  const { copy, tx, form, button, badge } = base;
  const t = key => platformText(lang, key);
  const fold = (label, body, expanded = false) => `<details${expanded ? ' open' : ''}><summary>${label}</summary><div class="fold">${body}</div></details>`;
  const list = data => `<dl class="receipt-lines">${data.map(([title, value]) => `<div><dt>${title}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  const custom = text => `<button class="button">${text}</button>`;
  const breadcrumb = (teacher, config) => `<div class="workspace-head"><a href="${teacher ? '/teacher' : '/company/' + config.companyId}">${teacher ? tx('teacherHome') : escape(config.company)}</a>
    <span aria-hidden="true">/</span><span>${copy(config.title)}</span></div>`;

  function brief(config) {
    return breadcrumb(false, config) + `<section class="work-panel lesson-brief"><h1>${copy(config.title)}</h1><p class="lead">${copy(config.description)}</p>
      <p class="notice">${tx('openingTotal')} <strong>${money(config.opening)}</strong></p>
      <form method="post" class="actions"><input type="hidden" name="request" value="${crypto.randomUUID()}">${button('open')}</form></section>`;
  }

  function quantities(lines, id, config, limit) {
    return lines.map(line => {
      const item = config.items.find(product => product.id === line.id);
      const field = 'qty-' + id + '-' + item.id;
      return `<div class="register-line"><label for="${field}">${copy(item.name)}</label><span>${money(item.amount)}</span>
        <input id="${field}" name="qty-${item.id}" type="number" min="0" max="${limit ? line.quantity : 99}" step="1" value="0"></div>`;
    }).join('');
  }

  function reportMenu(config, events) {
    const reports = events.filter(event => event.report);
    const keys = { opening:'openingTotal', sales:'salesTotal', refunds:'refundsTotal', journal:'journal', cash:'cash', delta:'delta' };
    return reports.length ? `<section class="resources"><h2>${t('shiftReports')}</h2>
      ${reports.toReversed().map(event => fold(copy(config.documents[event.kind === 'finish' ? 'z' : 'x']) + ' · ' + date(event.at, lang),
        list([...Object.entries(keys).map(([key, label]) => [tx(label), money(event.report[key])]),
          [t('saleCount'), event.sales], [t('refundCount'), event.refunds]]), event.kind === 'finish')).join('')}</section>` : '';
  }

  function receiptLine(config, line) {
    return [copy(config.items.find(item => item.id === line.id).name) + ' × ' + line.quantity, money(line.unit * line.quantity)];
  }

  function receipts(attempt, readOnly) {
    const { config, state: { events } } = attempt;
    const sales = events.filter(event => event.kind === 'sale');
    return `<section class="resources register-receipts"><h2>${t('receipts')}</h2>${sales.length ? sales.toReversed().map(sale => {
      const items = availableItems(sale, events).filter(line => line.quantity > 0);
      const refunds = events.filter(event => event.kind === 'refund' && event.original === sale.receipt);
      const returned = refunds.map(event => fold(copy(config.documents.refund) + ' ' + event.receipt,
        list([...event.lines.map(line => receiptLine(config, line)), [t('cashReturns'), money(event.amount)]]))).join('');
      const request = items.length > 0 ? form(attempt, 'return', `<p>${t('unreturned')}</p>
        <input type="hidden" name="receipt" value="${sale.receipt}">${quantities(items, sale.receipt, config, true)}
        <div class="actions">${custom(t('refundByReceipt'))}</div>`,
        `class="register-refund" data-draft="${attempt.id}/refund/${sale.receipt}/${refunds.length}"`) : `<p class="notice">${t('noReturnItems')}</p>`;
      const receipt = list([...sale.lines.map(line => receiptLine(config, line)), [tx('total'), money(sale.amount)],
        [tx('tender'), money(sale.tender)], [tx('change'), money(sale.change)]]);
      return fold(copy(config.documents.sale) + ' ' + sale.receipt + ' · ' + money(sale.amount),
        receipt + returned + (readOnly ? '' : request), sale === sales.at(-1));
    }).join('') : `<p class="muted">${tx('evidenceEmpty')}</p>`}</section>`;
  }

  function draw(attempt, teacher = false, error) {
    const { config, state } = attempt;
    const readOnly = teacher || state.step === 'done';
    const balance = practiceBalances(config, state.events);
    const sales = state.events.filter(event => event.kind === 'sale');
    const last = state.events.at(-1);
    const lastDamage = last.kind === 'changeError' ? `<p class="notice alert" role="status">${tx('wrongChange')}</p>` : '';
    const header = `<div class="page-heading"><div><h1>${copy(config.title)}</h1><p class="lead">${teacher ? escape(people[attempt.owner]?.name ?? attempt.owner) + ' · ' : ''}${escape(config.company)} · ${tx('caseVersion')} ${config.version}</p></div>
      ${badge(state.step === 'done' ? 'done' : 'active')}</div>`;
    const current = `<section class="register-status"><div><span>${tx('cash')}</span><strong>${money(balance.cash)}</strong></div>
      <div><span>${t('saleCount')}</span><strong>${sales.length}</strong></div>
      <div><span>${t('refundCount')}</span><strong>${state.events.filter(event => event.kind === 'refund').length}</strong></div></section>`;
    const errors = error ? `<p class="notice alert" role="alert">${['basketError','tenderError','returnError'].includes(error) ? t(error) : tx(error)}</p>` : '';
    const selling = form(attempt, 'sell', `<div class="register-line"><strong>${copy(config.documents.item)}</strong><strong>${t('unit')}</strong><strong>${t('quantity')}</strong></div>
      ${quantities(config.items, 'sale', config, false)}<div class="register-payment">
      <label>${tx('tender')}<input name="tender" required inputmode="numeric" pattern="[0-9]+" maxlength="12"></label>
      <label>${tx('change')}<input name="change" required inputmode="numeric" pattern="[0-9]+" maxlength="12"></label></div>
      <div class="actions">${button('sale')}</div>`, `data-draft="${attempt.id}/sale/${sales.length}"`);
    const controls = readOnly ? '' : `<section class="work-panel"><h2>${t('newSale')}</h2>${lastDamage}${selling}
      <div class="register-close">${form(attempt, 'reportX', button('reportX', { quiet: true }))}${form(attempt, 'finish', custom(t('closeRegister')))}</div></section>`;
    const timeline = `<section class="work-panel timeline"><h2>${tx('history')}</h2><ol>${state.events.map(event => {
      const names = { open:'openingEvent', sale:'saleEvent', changeError:'changeErrorEvent', refund:'refundEvent', reportX:'reportXEvent', finish:'finishEvent' };
      const detail = event.receipt ? event.receipt + ' · ' + money(event.amount) : event.change !== undefined ? tx('change') + ' ' + money(event.change) : '';
      return `<li><time>${date(event.at, lang)}</time><div><strong>${tx(names[event.kind])}</strong><p>${detail}</p></div></li>`;
    }).join('')}</ol></section>`;
    return breadcrumb(teacher, config) + header + current + errors + `<div class="register-grid"><div>${controls}${readOnly ? timeline : ''}</div>
      <aside class="result-aside">${receipts(attempt, readOnly)}${reportMenu(config, state.events)}
      <details class="assumption"><summary>${tx('assumption')}</summary><p>${copy(config.assumption)}</p></details></aside></div>`;
  }
  return { brief, draw };
}
