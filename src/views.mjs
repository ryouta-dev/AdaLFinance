import { labels } from './labels.mjs';
import { balances, statuses, steps, totals } from './shift.mjs';
import { people } from './auth.mjs';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fill = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
export const formatInteger = value => String(value).replace('-', '−').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const money = value => formatInteger(value) + ' ₸';
export const date = (at, lang) => new Intl.DateTimeFormat(lang === 'kk' ? 'kk-KZ' : 'ru-KZ', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qyzylorda'
}).format(new Date(at));
export const icon = (path, className = '') => `<svg class="${className}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const mark = icon('<path d="M4 19 12 4l8 15M8 13h8M9.5 19h5"/>', 'brand-mark');
const receiptIcon = icon('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3"/>');

export function views(lang) {
  const tx = (key, values) => escape(fill(labels[key][lang === 'kk' ? 1 : 0], values));
  const copy = (pair, values) => escape(fill(pair[lang], values));
  const badge = status => `<span class="badge ${status}">${tx(status)}</span>`;
  const attemptURL = (attempt, teacher = false) => `${teacher ? '/teacher' : ''}/attempt/${attempt.id}`;
  const button = (key, { quiet = false, values, label = key } = {}) => `<button class="button${quiet ? ' secondary' : ''}" type="submit">${tx(label, values)}</button>`;
  const link = (key, url, quiet = false) => `<a class="button${quiet ? ' secondary' : ''}" href="${url}">${tx(key)}</a>`;
  const form = (attempt, action, content, attributes = '') => `<form method="post" action="${attemptURL(attempt)}" ${attributes}>
    <input type="hidden" name="action" value="${action}"><input type="hidden" name="request" value="${crypto.randomUUID()}">
    <input type="hidden" name="revision" value="${attempt.revision}">${content}</form>`;

  function layout(title, body, user, path) {
    const home = user?.role === 'teacher' ? '/teacher' : '/';
    const nav = user?.role === 'teacher'
      ? [['/teacher', 'teacherHome'], ['/teacher/analytics', 'analytics'], ['/teacher/builder', 'builder'], ['/teacher/qr', 'qr'], ['/teacher/team', 'teams'], ['/teacher/cup', 'cup']]
      : [['/', 'city'], ['/bank', 'bank'], ['/portfolio', 'portfolio'], ['/team', 'teams'], ['/cup', 'cup']];
    const pathname = path.split('?')[0];
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="theme-color" content="#f6f7f2"><title>${title} · ADAL FINANCE 360 AI</title>
      <link rel="stylesheet" href="/assets/app.css"><script src="/assets/app.js" defer></script></head><body>
      <a class="skip-link" href="#main">${tx('skipContent')}</a><header class="top"><div class="top-inner">
        <a class="brand" href="${home}">${mark}<span>ADAL FINANCE <b>360 AI</b></span></a>
        <div class="top-actions"><nav class="language" aria-label="${lang === 'kk' ? 'Тіл' : 'Язык'}">
          <a href="/language?lang=kk&amp;back=${encodeURIComponent(path)}" hreflang="kk" lang="kk" ${lang === 'kk' ? 'aria-current="true"' : ''}>Қазақша</a>
          <a href="/language?lang=ru&amp;back=${encodeURIComponent(path)}" hreflang="ru" lang="ru" ${lang === 'ru' ? 'aria-current="true"' : ''}>Русский</a></nav>
          ${user ? `<form method="post" action="/logout"><button class="text-button" type="submit">${tx('signOut')}</button></form>` : ''}</div>
      </div>${user ? `<nav class="platform-nav" aria-label="ADAL FINANCE"><div class="nav-inner">${nav.map(([url, key]) =>
        `<a href="${url}"${pathname === url || (url.endsWith('/qr') && pathname.startsWith(url + '/')) ? ' aria-current="page"' : ''}>${tx(key)}</a>`).join('')}</div></nav>` : ''}
      </header><main id="main" class="page" tabindex="-1">${body}</main></body></html>`;
  }

  function login(error) {
    return `<div class="login-grid"><section class="login-feature"><img src="/assets/city.jpg" alt="" fetchpriority="high">
      <div><span class="feature-label">${tx('simulator')}</span><strong>ADAL City</strong></div></section>
      <section class="login-form"><h1>${tx('loginTitle')}</h1><p class="lead">${tx('loginLead')}</p>
        ${error ? `<p class="notice alert" role="alert">${tx('invalidLogin')}</p>` : ''}
        <form method="post" action="/login" class="stack">
          <label>${tx('login')}<input name="username" autocomplete="username" required maxlength="40"></label>
          <label>${tx('password')}<input name="password" type="password" autocomplete="current-password" required maxlength="80"></label>${button('signIn')}
        </form><details class="demo"><summary>${tx('demo')}</summary><dl>${Object.values(people).map(person => `<div><dt>${tx(person.role)}</dt><dd><code>${person.username} / ${person.password}</code></dd></div>`).join('')}</dl></details>
      </section></div>`;
  }

  function list(attempts, teacher) {
    if (!attempts.length) return `<p class="empty">${tx('noAttempts')}</p>`;
    return `<ul class="attempt-list">${attempts.map(attempt => `<li>
      <div><strong>${copy(attempt.config.title)}</strong><div class="muted caption">${teacher ? `${escape(people[attempt.owner]?.name ?? attempt.owner)} · ` : ''}${date(attempt.started_at, lang)} · ${tx('caseVersion')} ${attempt.config.version}</div></div>
      <div class="list-action">${badge(attempt.finished_at ? 'done' : 'active')}
        ${link(teacher || attempt.finished_at ? 'details' : 'continue', attemptURL(attempt, teacher), true)}</div></li>`).join('')}</ul>`;
  }

  function cabinet(user, cases, attempts) {
    const teacher = user.role === 'teacher';
    const heading = teacher ? 'teacherHome' : 'cases';
    return `<div class="page-heading"><div><h1>${tx(heading)}</h1><p class="lead">${escape(user.name)}</p></div><span class="group-label">${tx('group')} <strong>${escape(user.group)}</strong></span></div>
      ${teacher ? '' : `<div class="case-list">${cases.map(config => {
        const active = attempts.find(attempt => !attempt.finished_at && attempt.config.companyId === config.companyId && attempt.config.caseId === config.caseId);
        return `<article class="case-hero"><div class="case-copy"><p class="company">${receiptIcon}${escape(config.company)}</p>
          <h2>${copy(config.title)}</h2><p>${copy(config.description)}</p><div class="actions">
          ${active ? link('continue', attemptURL(active)) : ''}${link('start', `/case/${config.companyId}/${config.caseId}`, !!active)}</div></div>
          ${config.image ? `<img src="${escape(config.image)}" alt="" fetchpriority="high">` : ''}</article>`;
      }).join('')}</div>`}
      <section class="archive"><h2>${tx('attempts')}</h2>${list(attempts, teacher)}</section>`;
  }

  function meter(balance, initial = null) {
    const parts = ['journal', 'cash', 'delta'];
    return `<section class="balance" aria-label="${tx('balance')}"><h2>${tx('balance')}</h2><dl>${parts.map(key => `<div class="meter-${key} ${key === 'delta' && balance.delta !== 0 ? 'has-gap' : ''}"><dt>${tx(key)}</dt><dd>${money(balance[key])}</dd></div>`).join('')}</dl>
      ${initial && initial.delta !== balance.delta ? `<p>${tx('before')} <strong>${money(initial.delta)}</strong></p>` : ''}</section>`;
  }

  function rail(config, current) {
    return `<nav class="steps" aria-label="${tx('steps')}"><h2>${tx('steps')}</h2><ol>${[...steps, 'done'].map((step, index) => {
      const active = step === current;
      return `<li class="${active ? 'current' : index < steps.indexOf(current) || current === 'done' ? 'past' : ''}"${active ? ' aria-current="step"' : ''}><span>${index + 1}</span>${step === 'done' ? tx('result') : copy(config.steps[step].title)}</li>`;
    }).join('')}</ol></nav>`;
  }

  function workspaceHead(config, back) {
    return `<div class="workspace-head"><a href="${back === 'teacherHome' ? '/teacher' : '/'}">${tx(back)}</a><span aria-hidden="true">/</span><span>${escape(config.company)}</span></div>`;
  }

  function itemRows(items) {
    return items.map(item => `<div><dt>${copy(item.name)}</dt><dd>${money(item.amount)}</dd></div>`).join('');
  }

  function open(config, cup = false) {
    return `${workspaceHead(config, 'studentHome')}<div class="work-grid">${rail(config, 'open')}
      <section class="work-panel"><div class="work-title"><h1>${copy(config.steps.open.title)}</h1><span>1 / 7</span></div>
        <p class="lead">${copy(config.steps.open.task, { opening: money(config.opening) })}</p>${cup ? `<p class="notice">${tx('cupMode')}</p>` : ''}
        ${meter(balances(config, []))}<form method="post" class="actions"><input type="hidden" name="request" value="${crypto.randomUUID()}">${button('open')}</form>
      </section></div>`;
  }

  function journal(config, events, attempt) {
    const lines = [];
    for (const event of events) {
      if (event.kind === 'open') lines.push(`<div><dt>${tx('openingEvent')}</dt><dd>${money(config.opening)}</dd></div>`);
      if (event.kind === 'sale') lines.push(`<div><dt>${copy(config.documents.sale)} <small>${receiptId(attempt, 'S')}</small></dt><dd>+${money(event.amount)}</dd></div>`);
      if (event.kind === 'refund' || event.kind === 'correction') lines.push(`<div><dt>${copy(config.documents.refund)} <small>${receiptId(attempt, 'R')}</small></dt><dd>${money(-event.amount)}</dd></div>`);
    }
    return `<dl class="receipt-lines">${lines.join('')}<div class="sum"><dt>${tx('total')}</dt><dd>${money(balances(config, events).journal)}</dd></div></dl>`;
  }

  function receiptId(attempt, prefix) { return `${prefix}-${attempt.id.slice(0, 8).toUpperCase()}`; }

  function resources(attempt, openDocs = false) {
    const { config, state: { events } } = attempt;
    const sale = events.find(event => event.kind === 'sale');
    const refund = events.find(event => event.kind === 'refund' || event.kind === 'correction');
    const initial = events.find(event => event.kind === 'skip' || event.kind === 'refund');
    const reconciliation = events.find(event => event.kind === 'confirm');
    const doc = config.documents;
    const xReports = events.filter(event => event.kind === 'reportX');
    const z = events.find(event => event.kind === 'finish' && event.report);
    const payment = `<div><dt>${copy(doc.payment)}</dt><dd>${copy(doc.cash)}</dd></div>`;
    const fold = (name, body, show = false) => `<details${show ? ' open' : ''}><summary>${copy(doc[name])}</summary><div class="fold">${body}</div></details>`;
    return `<section class="resources"><h2>${tx('evidence')}</h2>
      ${fold('journal', journal(config, events, attempt), openDocs)}
      ${sale ? fold('sale', `<p class="receipt-code">${receiptId(attempt, 'S')}</p><dl class="receipt-lines">${payment}<div class="document-head"><dt>${copy(doc.item)}</dt><dd>${copy(doc.amount)}</dd></div>${itemRows(config.items)}<div class="sum"><dt>${tx('total')}</dt><dd>${money(sale.amount)}</dd></div>
        ${sale.tender ? `<div><dt>${tx('tender')}</dt><dd>${money(sale.tender)}</dd></div><div><dt>${tx('change')}</dt><dd>${money(sale.change)}</dd></div>` : ''}</dl>`, openDocs) : `<p class="muted caption">${tx('evidenceEmpty')}</p>`}
      ${refund ? fold('refund', `<p class="receipt-code">${receiptId(attempt, 'R')}</p><dl class="receipt-lines">
        <div><dt>${copy(doc.original)}</dt><dd>${receiptId(attempt, 'S')}</dd></div>${payment}
        <div class="document-head"><dt>${copy(doc.item)}</dt><dd>${copy(doc.amount)}</dd></div>
        ${itemRows([totals(config).item])}</dl>`) : ''}
      ${reconciliation ? fold('reconciliation', `<dl class="receipt-lines">${['journal', 'cash', 'delta'].map(key => `<div><dt>${tx(key)}</dt><dd>${money(reconciliation.balance[key])}</dd></div>`).join('')}${initial?.balance.delta ? `<div><dt>${tx('before')}</dt><dd>${money(initial.balance.delta)}</dd></div>` : ''}</dl>`) : ''}
      ${xReports.map(event => fold('x', reportRows(event.report, event.at))).join('')}
      ${z ? fold('z', reportRows(z.report, z.at)) : ''}</section>`;
  }

  function reportRows(report, at) {
    const fields = { opening: 'openingTotal', sales: 'salesTotal', refunds: 'refundsTotal', journal: 'journal', cash: 'cash', delta: 'delta' };
    return `<p class="muted caption">${date(at, lang)}</p><dl class="receipt-lines">${Object.entries(fields)
      .map(([key, label]) => `<div><dt>${tx(label)}</dt><dd>${money(report[key])}</dd></div>`).join('')}</dl>`;
  }

  function work(attempt, error) {
    const { config, state: { step, events } } = attempt;
    const { sale, refund, item } = totals(config);
    const balance = balances(config, events);
    const paid = events.some(event => event.kind === 'payout');
    const correction = events.find(event => event.kind === 'correction');
    const lastCause = events.findLast(event => event.kind === 'causeError');
    const lastAnswer = events.findLast(event => event.kind === 'check');
    const opened = events.some(event => event.kind === 'hint' && event.step === step);
    const task = config.steps[step];
    const action = (key, options) => form(attempt, key, button(key, options));
    let stage = '';
    if (step === 'sale') {
      const wrong = events.findLast(event => event.kind === 'changeError');
      const saleAction = config.register ? form(attempt, 'sale', `<label>${tx('change')}<input name="change" inputmode="numeric" pattern="[0-9]+" maxlength="12" required value="${wrong?.change ?? ''}"></label><div class="actions">${button('sale')}</div>`,
        `class="stack cash-sale" data-draft="${attempt.id}/change"`) : `<div class="actions">${action('sale')}</div>`;
      stage = `<dl class="receipt-lines basket">${itemRows(config.items)}<div class="sum"><dt>${tx('total')}</dt><dd>${money(sale)}</dd></div></dl>
        ${wrong ? `<p class="notice alert" role="status">${tx('wrongChange')}</p>` : ''}${saleAction}`;
    }
    if (step === 'refund') stage = !paid ? `<div class="actions">${action('payout', { values: { amount: money(refund) } })}</div>` :
      `<p class="notice">${tx('payoutDone', { amount: money(refund) })}</p><h2 class="mini-title">${tx('refundChoice')}</h2><div class="actions">${action('record')}${action('skip', { quiet: true })}</div>`;
    if (step === 'reconcile') stage = `<p class="notice ${balance.delta ? 'alert' : 'success'}">${copy(config.feedback[balance.delta ? 'discrepancy' : correction ? 'corrected' : 'balanced'])}</p>` + (balance.delta ? `
      ${lastCause ? `<p class="feedback-error" role="status">${copy(config.feedback.wrongCause)}</p>` : ''}
      ${form(attempt, 'correct', `<label>${tx('cause')}<select name="cause" required><option value="">${tx('choose')}</option>${config.causes.map(cause => `<option value="${escape(cause.id)}" ${lastCause?.cause === cause.id ? 'selected' : ''}>${copy(cause.label)}</option>`).join('')}</select></label>
      <div class="actions">${button('correct')}</div>`, `class="stack" data-draft="${attempt.id}/cause"`)}` : `<div class="actions">${action('confirm')}</div>`);
    if (step === 'posting') stage = posting(attempt, lastAnswer);
    if (step === 'finish') stage = `<div class="actions">${action('finish')}</div>`;
    const showBalance = ['reconcile', 'finish'].includes(step);
    return `${workspaceHead(config, 'studentHome')}<div class="work-grid">${rail(config, step)}
      <div class="work-main"><section class="work-panel"><div class="work-title"><h1>${copy(task.title)}</h1><span>${steps.indexOf(step) + 1} / 7</span></div>
        <p class="lead">${copy(task.task, { sale: money(sale), refund: money(refund), item: item.name[lang], tender: config.register ? money(config.register.tender) : '' })}</p>
        ${error ? `<p class="notice alert" role="alert">${tx(error)}</p>` : ''}${showBalance ? meter(balance, correction?.before) : ''}${stage}</section>
        <div class="work-tools">${resources(attempt)}<div class="assistance">${config.register && ['reconcile', 'posting', 'finish'].includes(step) ? action('reportX', { quiet: true }) : ''}${task.hint && !attempt.state.cup ? `<section><h2>${tx('hint')}</h2>${opened ? `<p>${copy(task.hint)}</p>` : action('hint', { quiet: true, label: 'showHint' })}</section>` : ''}
        <details class="assumption"><summary>${tx('assumption')}</summary><p>${copy(config.assumption)}</p></details></div></div>
      </div></div>`;
  }

  function posting(attempt, answer) {
    const { config } = attempt;
    const account = (type) => `<label>${tx(type)}<select name="${type}" required><option value="">${tx('choose')}</option>${config.accounts.map(item => `<option value="${escape(item.code)}" ${answer?.[type] === item.code ? 'selected' : ''}>${escape(item.code)} · ${copy(item.label)}</option>`).join('')}</select></label>`;
    const key = config.keys.posting;
    return `${answer ? `<p class="notice ${answer.correct ? 'success' : 'alert'}" role="status">${copy(config.feedback[answer.correct ? 'postingGood' : 'postingBad'], { ...key, amount: money(key.amount) })}</p>` : ''}
      ${form(attempt, 'check', `<div class="posting-fields">${account('debit')}${account('credit')}<label>${tx('amount')}<input name="amount" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="12" value="${answer?.amount ?? ''}" required></label></div><div class="actions">${button('check', { quiet: !!answer })}</div>`, `data-draft="${attempt.id}/posting"`)}
      ${answer ? `<div class="actions">${form(attempt, 'next', button('next'))}</div>` : ''}`;
  }

  const eventsLabels = { open: 'openingEvent', sale: 'saleEvent', payout: 'payoutEvent', refund: 'refundEvent', skip: 'skipEvent', causeError: 'causeErrorEvent', correction: 'correctionEvent', confirm: 'confirmEvent', check: 'checkEvent', next: 'nextEvent', finish: 'finishEvent', hint: 'hintEvent', changeError: 'changeErrorEvent', reportX: 'reportXEvent' };

  function balanceText(balance) {
    return ['journal', 'cash', 'delta'].map(key => `${tx(key)} ${money(balance[key])}`).join(' · ');
  }

  function eventDetail(config, event) {
    if (event.kind === 'hint') return `${copy(config.steps[event.step].title)}. ${copy(config.steps[event.step].hint)}`;
    if (event.kind === 'check') return `${tx('debit')} ${escape(event.debit)} · ${tx('credit')} ${escape(event.credit)} · ${money(event.amount)} · ${tx(event.correct ? 'postingRight' : 'postingWrong')}`;
    const parts = [];
    if (event.change !== undefined) parts.push(tx('change') + ' ' + money(event.change));
    if (event.cause) parts.push(copy(config.causes.find(cause => cause.id === event.cause).label));
    if (event.amount !== undefined) parts.push(money(event.amount));
    if (event.balance) parts.push(balanceText(event.balance));
    if (event.report) parts.push(balanceText(event.report));
    return parts.join(' · ');
  }

  function result(attempt, teacher) {
    const { config, state, owner } = attempt;
    const { events } = state;
    const initial = events.find(event => event.kind === 'skip' || event.kind === 'refund');
    const correction = events.find(event => event.kind === 'correction');
    const hints = events.filter(event => event.kind === 'hint');
    const results = statuses(state);
    return `${workspaceHead(config, teacher ? 'teacherHome' : 'studentHome')}
      <div class="page-heading result-heading"><div><h1>${state.step === 'done' ? tx('result') : copy(config.title)}</h1><p class="lead">${teacher ? `${escape(people[owner]?.name ?? owner)} · ` : ''}${copy(config.title)} · ${tx('caseVersion')} ${config.version}</p></div>${badge(attempt.finished_at ? 'done' : 'active')}</div>
      <div class="result-grid"><div class="result-main"><section class="work-panel">${meter(balances(config, events), correction?.before)}
        ${initial ? `<div class="decision"><h2>${tx('initialDecision')}</h2><p>${tx(initial.kind === 'skip' ? 'initialSkip' : 'initialRecord')}</p><p class="caption muted">${balanceText(initial.balance)}</p>
        ${correction ? `<h2>${tx('correction')}</h2><p>${copy(config.feedback.corrected)}</p><p class="caption muted">${balanceText(correction.balance)}</p>` : ''}</div>` : ''}
        <dl class="counts"><div><dt>${tx('issueCount')}</dt><dd>${events.filter(event => event.kind === 'payout').length}</dd></div><div><dt>${tx('recordCount')}</dt><dd>${events.filter(event => ['refund', 'correction'].includes(event.kind)).length}</dd></div></dl></section>
        <section class="work-panel timeline"><h2>${tx('history')}</h2><ol>${events.map(event => `<li><time datetime="${escape(event.at)}">${date(event.at, lang)}</time><div><strong>${tx(eventsLabels[event.kind])}</strong><p>${eventDetail(config, event)}</p></div></li>`).join('')}</ol></section>
      </div><aside class="result-aside"><section class="results-by-step"><h2>${tx('resultsByStep')}</h2><ul>${steps.map(step => `<li><span>${copy(config.steps[step].title)}</span>${badge(results[step])}</li>`).join('')}</ul></section>
        <section><h2>${tx('openedHints')}</h2>${hints.length ? `<ul class="hint-list">${hints.map(event => `<li><strong>${copy(config.steps[event.step].title)}</strong><p>${copy(config.steps[event.step].hint)}</p></li>`).join('')}</ul>` : `<p class="muted">${tx('noHints')}</p>`}</section>
        ${resources(attempt)}<details class="assumption"><summary>${tx('assumption')}</summary><p>${copy(config.assumption)}</p></details>
      </aside></div>`;
  }

  return { tx, copy, badge, link, button, form, list, login, layout, cabinet, open, work, result, error: key => `<h1>${tx(key)}</h1>` };
}
