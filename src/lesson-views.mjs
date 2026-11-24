import { accounts, accountsSource } from '../content/accounts.mjs';
import { officialAccountNames } from '../content/official-account-names.mjs';
import { escape, date, formatInteger, money } from './views.mjs';
import { platformLabels } from './platform-labels.mjs';
import { lessonPostings, lessonResults } from './lesson.mjs';
import { personas } from './mentor.mjs';
import { financialStatements, trialBalance, trialTotals, vatSummary } from './reports.mjs';

export const platformText = (lang, key) => escape(platformLabels[key][lang === 'kk' ? 1 : 0]);
export const caseURL = (item, cup = false) => '/case/' + item.companyId + '/' + item.caseId + (cup ? '?cup=1' : '');
export const attemptURL = (item, teacher = false) => (teacher ? '/teacher' : '') + '/attempt/' + item.id;

export function table(title, columns, rows, total) {
  const cells = row => row.map(value => ' <td>' + value + '</td>').join('');
  return `<div class="table-scroll" role="region" aria-label="${title}" tabindex="0"><table>
    <thead><tr>${columns.map(key => '<th scope="col">' + key + '</th>').join('')}</tr></thead>
    <tbody>${rows.map(row => '<tr>' + cells(row) + '</tr>').join('')}</tbody>
    ${total ? '<tfoot><tr>' + cells(total) + '</tr></tfoot>' : ''}</table></div>`;
}

export function fieldControls(fields, prefix, selected, allowedAccounts, lang, base) {
  const { copy, tx } = base;
  return fields.map(field => {
    const id = prefix + '-' + field.id;
    const label = `<label for="${id}">${copy(field.label)}</label>`;
    const value = selected?.[field.id] ?? '';
    if (field.kind === 'number') {
      return `<div class="field">${label}<input id="${id}" name="answer-${field.id}" inputmode="text" pattern="-?[0-9]+" required maxlength="13" value="${escape(value)}" autocomplete="off"></div>`;
    }
    const options = field.kind === 'choice'
      ? field.options.map(item => [item.id, copy(item.label)])
      : accounts.filter(item => !allowedAccounts || allowedAccounts.includes(item.code)).map(item => [item.code, escape(item.code) + ' · ' + copy(item.label)]);
    return `<div class="field">${label}<select id="${id}" required name="answer-${field.id}"><option value="">${tx('choose')}</option>
      ${options.map(([key, name]) => `<option value="${escape(key)}"${key === value ? ' selected' : ''}>${name}</option>`).join('')}</select></div>`;
  }).join('');
}

export function answerText(field, value, copy) {
  if (field.kind === 'choice') {
    const option = field.options.find(item => item.id === value);
    return option ? copy(option.label) : escape(value);
  }
  return field.kind === 'number' && Number.isInteger(value) ? formatInteger(value) : escape(value);
}

export function lessonViews(lang, base) {
  const { copy, form, tx, button, badge } = base;
  const t = key => platformText(lang, key);
  const chooseButton = (title, quiet = false) => `<button class="button${quiet ? ' secondary' : ''}">${title}</button>`;
  const action = (attempt, key, title, quiet) => form(attempt, key, chooseButton(title, quiet));
  const kv = rows => `<dl class="receipt-lines">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  const fold = (title, body, open = false) => `<details${open ? ' open' : ''}><summary>${title}</summary><div class="fold">${body}</div></details>`;
  const home = (config, teacher = false) => `<div class="workspace-head"><a href="${teacher ? '/teacher' : '/'}">${tx(teacher ? 'teacherHome' : 'city')}</a>
    <span aria-hidden="true">/</span><a href="${teacher ? '/teacher' : '/company/' + config.companyId}">${escape(config.company)}</a><span aria-hidden="true">/</span><span>${copy(config.title)}</span></div>`;

  function brief(config, cup) {
    return home(config) + `<div class="lesson-brief work-panel"><h1>${copy(config.title)}</h1><p class="lead">${copy(config.description)}</p>
      ${cup ? `<p class="notice">${tx('cupMode')}</p>` : ''}
      <h2>${t('exerciseSteps')}</h2><ol>${config.steps.map(task => `<li>${copy(task.title)}</li>`).join('')}</ol>
      <form method="post" class="actions" action="${caseURL(config, cup)}"><input type="hidden" name="request" value="${crypto.randomUUID()}">${chooseButton(t('caseStart'))}</form></div>`;
  }

  function stepRail(config, attempt) {
    return `<nav class="steps" aria-label="${t('exerciseSteps')}"><h2>${t('exerciseSteps')}</h2><ol>
      ${[...config.steps.map(task => copy(task.title)), t('completeLesson')].map((title, index) =>
        `<li class="${index === attempt.state.index ? 'current' : index < attempt.state.index ? 'past' : ''}"${index === attempt.state.index ? ' aria-current="step"' : ''}><span>${index + 1}</span>${title}</li>`).join('')}</ol></nav>`;
  }

  function documents(config) {
    const values = config.documents ?? [];
    return values.length ? `<section class="resources lesson-files"><h2>${tx('evidence')}</h2>
      ${values.map(doc => fold(`${copy(doc.title)} <span class="doc-id">${escape(doc.id)}</span>`, kv(doc.rows.map(row => {
        const value = typeof row.value === 'number' ? money(row.value) : typeof row.value === 'string' ? escape(row.value) : copy(row.value);
        return [copy(row.label), value];
      })))).join('')}</section>` : '';
  }

  function mentor(attempt, task) {
    const { config, state } = attempt;
    if (!task || state.cup || config.diagnostic) return '';
    const records = state.events.filter(event => event.index === state.index);
    const hint = records.some(event => event.kind === 'hint');
    const messages = records.filter(event => event.kind === 'mentor');
    const preferred = config.persona ?? 'accountant';
    const entries = messages.map(message => `<li><p>${escape(message.question)}</p>
      <div><strong>${copy(personas[message.persona])}</strong> <span class="muted caption">${t(message.mode)}</span></div>
      <p lang="${message.lang}">${escape(message.answer)}</p></li>`).join('');
    const ask = state.events.filter(event => event.kind === 'mentor').length >= 16 ? `<p>${t('mentorLimit')}</p>` :
      form(attempt, 'mentor', `<label>${t('mentorRole')}<select name="persona">${Object.entries(personas).map(([key, pair]) =>
        `<option value="${key}"${key === preferred ? ' selected' : ''}>${copy(pair)}</option>`).join('')}</select></label>
        <label>${t('mentorQuestion')}<textarea name="question" required maxlength="450" rows="2"></textarea></label>
        ${chooseButton(t('ask'), true)}`, `class="stack" data-draft="${attempt.id}/mentor/${state.index}"`);
    return `<section class="mentor-panel"><div class="mentor-title"><h2>${t('mentor')}</h2></div>
      ${hint ? `<p class="notice">${copy(task.hint)}</p>` : action(attempt, 'hint', tx('showHint'), true)}
      <details class="mentor-box"${messages.length ? ' open' : ''}><summary>${t('ask')}</summary>${entries ? '<ol class="mentor-messages">' + entries + '</ol>' : ''}${ask}</details></section>`;
  }

  function ledger(attempt, complete) {
    const { config, state } = attempt;
    if (!config.opening) return '';
    const entries = config.ledger ?? lessonPostings(config, state);
    const rows = trialBalance(config.opening, entries);
    const sums = trialTotals(rows);
    const keys = ['openingDebit', 'openingCredit', 'debit', 'credit', 'closingDebit', 'closingCredit'];
    const trial = table(t('trial'), [t('account'), ...keys.map(t)], rows.map(row => [escape(row.code), ...keys.map(key => money(row[key]))]),
      [tx('total'), ...keys.map(key => money(sums[key]))]);
    const journal = entries.length ? table(t('postingRegister'), [t('doc'), tx('debit'), tx('credit'), tx('amount')],
      entries.map(entry => [escape(entry.doc), escape(entry.debit), escape(entry.credit), money(entry.amount)])) : `<p class="muted">${t('noEvidence')}</p>`;
    const report = config.artifact === 'finance' && complete ? financialStatements(rows) : null;
    return `<section class="registers resources"><h2>${config.artifact === 'finance' ? t('reportFinance') : t('registers')}</h2>
      ${fold(t('postingRegister'), journal, !report)}
      ${fold(t('trial'), trial, !report)}
      ${report ? fold(t('financialPosition'), kv([
        [t('asset'), money(report.asset)], [t('liability'), money(report.liability)], [t('equity'), money(report.closingEquity)], [t('difference'), money(report.difference)]
      ]), true) + fold(t('profitReport'), kv([
        [t('income'), money(report.income)], [t('expense'), money(report.expense)], [t('profit'), money(report.profit)]
      ]), true) : ''}<p><a href="/accounts">${t('plan')}</a></p></section>`;
  }

  function resultReports(attempt) {
    const { config, state } = attempt;
    let reports = ledger(attempt, state.step === 'done');
    const outcomes = lessonResults(config, state).filter(row => row.task.outcome && row.last?.correct);
    for (const { task, last } of outcomes) {
      if (task.outcome === 'taxReturn' && config.artifact === 'tax') {
        const summary = vatSummary(config.taxInputs);
        const rows = ['salesBase', 'outputVat', 'inputVat', 'payable'].map(key => [t(key), money(config.taxInputs.submitted[key]), money(summary[key]), money(summary[key] - config.taxInputs.submitted[key])]);
        reports += `<section class="registers tax-return"><h2>${t('taxReturn')}</h2><p class="muted">${escape(config.taxInputs.period)}</p>
          ${table(t('taxReturn'), [t('indicator'), t('draft'), t('revised'), t('difference')], rows)}</section>`;
      } else if (['auditNote', 'ethicsNote'].includes(task.outcome)) {
        reports += `<section class="registers"><h2>${t(task.outcome)}</h2>${kv(task.fields.map(field => [copy(field.label), answerText(field, last.answers[field.id], copy)]))}<p>${copy(task.explanation)}</p></section>`;
      }
    }
    return reports;
  }

  function reference(config) {
    const assumptions = config.assumption ? fold(t('assumptions'), `<p>${copy(config.assumption)}</p>`) : '';
    const source = config.reference && /^https:\/\/adilet\.zan\.kz\/rus\/docs\/[A-Z0-9_]+$/.test(config.reference)
      ? `<p><a rel="noreferrer" href="${escape(config.reference)}">${t('source')}</a></p>` : '';
    return assumptions + source;
  }

  function work(attempt, error) {
    const { config, state } = attempt;
    const task = config.steps[state.index];
    const current = task ? lessonResults(config, state)[state.index] : null;
    let contents;
    if (!task) {
      contents = `<h1>${t('completeLesson')}</h1><p class="lead">${t('closeLesson')}</p><div class="actions">${action(attempt, 'finish', tx('finish'))}</div>`;
    } else {
      const reply = current.last;
      const feedback = reply ? `<p class="notice${!reply.correct && !config.diagnostic ? ' alert' : ''}" role="status">
        ${config.diagnostic || state.cup ? t('recorded') : reply.correct ? copy(task.explanation) : t('wrong')}</p>` : '';
      const canAnswer = !reply?.correct && !(config.diagnostic && reply) && current.attempts.length < 12;
      const fields = canAnswer ? form(attempt, 'answer',
        `<div class="lesson-fields">${fieldControls(task.fields, task.id, reply?.answers, config.accounts, lang, base)}</div><div class="actions">${chooseButton(t('submit'), !!reply)}</div>`,
        `data-draft="${attempt.id}/answer/${state.index}"`) : '';
      const next = reply ? `<div class="actions">${action(attempt, 'next', t('next'))}</div>` : '';
      contents = `<div class="work-title"><h1>${copy(task.title)}</h1><span>${state.index + 1} / ${config.steps.length + 1}</span></div>
        <p class="lead">${copy(task.prompt)}</p>${feedback}${fields}${next}`;
    }
    return home(config) + `<div class="work-grid">${stepRail(config, attempt)}<div class="work-main">
      <div class="lesson-work"><section class="work-panel">
      ${config.event && state.index === 0 ? `<div class="work-event"><strong>${t('event')}</strong><p>${copy(config.event)}</p></div>` : ''}
      ${state.cup ? `<p class="notice">${tx('cupMode')}</p>` : ''}
      ${error ? `<p class="notice alert" role="alert">${tx(error)}</p>` : ''}${contents}</section>
      <aside class="lesson-side">${documents(config)}${mentor(attempt, task)}${reference(config)}</aside></div>
      ${ledger(attempt, false)}</div></div>`;
  }

  function answers(task, item) {
    if (!item) return '';
    return task.fields.map(field => copy(field.label) + ' ' + answerText(field, item[field.id], copy)).join(' · ');
  }

  function result(attempt, user, teacher) {
    const { config, state } = attempt;
    const completed = state.step === 'done';
    const timeline = state.events.map(event => {
      const task = config.steps[event.index];
      let title;
      let details = '';
      if (event.kind === 'answer') {
        title = t('responseEvent');
        details = copy(task.title) + ' · ' + answers(task, event.answers) + ' · ' + tx(event.correct ? 'postingRight' : 'postingWrong');
      } else if (event.kind === 'mentor') {
        title = t('mentorEvent') + ' · ' + copy(personas[event.persona]);
        details = `${escape(event.question)}<br><span lang="${event.lang}">${escape(event.answer)}</span>`;
      } else if (event.kind === 'hint') {
        title = tx('hintEvent');
        details = copy(task.title) + ' · ' + copy(task.hint);
      } else {
        title = event.kind === 'open' ? t('caseStart') : event.kind === 'finish' ? tx('finishEvent') : t('next');
      }
      return `<li><time datetime="${escape(event.at)}">${date(event.at, lang)}</time><div><strong>${title}</strong><p>${details}</p></div></li>`;
    }).join('');
    const detail = lessonResults(config, state).map(row => `<li><div class="score-line"><h3>${copy(row.task.title)}</h3>${badge(row.status)}</div>
      ${row.first ? `<p><strong>${t('firstAnswer')}</strong> · ${answers(row.task, row.first.answers)}</p>` : ''}
      ${row.last && row.last !== row.first ? `<p><strong>${t('lastAnswer')}</strong> · ${answers(row.task, row.last.answers)}</p>` : ''}
      ${completed || teacher ? `<p class="muted">${copy(row.task.explanation)}${row.last?.correct ? '' : ' ' + t('answerKey') + ' · ' + answers(row.task, row.task.key)}</p>` : ''}</li>`).join('');
    return home(config, teacher) + `<div class="page-heading"><div><h1>${copy(config.title)}</h1><p class="lead">
      ${teacher ? escape(user?.name ?? attempt.owner) + ' · ' : ''}${tx('caseVersion')} ${config.version}</p></div>${badge(completed ? 'done' : 'active')}</div>
      <div class="result-grid"><div class="result-main"><section class="work-panel"><h2>${t('exerciseResult')}</h2>
      <ol class="lesson-results">${detail}</ol></section>${resultReports(attempt)}
      <section class="work-panel timeline"><h2>${tx('history')}</h2><ol>${timeline}</ol></section></div>
      <aside class="result-aside">${documents(config)}${reference(config)}${state.cup ? `<a class="button secondary" href="${teacher ? '/teacher/cup' : '/cup'}">${tx('cup')}</a>` : ''}</aside></div>`;
  }

  function plan(query) {
    const normalized = query.trim().toLocaleLowerCase(lang);
    const sections = ['currentAssets', 'longAssets', 'currentLiabilities', 'longLiabilities', 'equity', 'income', 'expense', 'productionAccounts'];
    const names = officialAccountNames.map(([code, ru, kk]) => [code, lang === 'kk' ? kk : ru])
      .filter(([code, title]) => (code + ' ' + title).toLocaleLowerCase(lang).includes(normalized));
    const tables = sections.map((label, index) => {
      const rows = names.filter(([code]) => code[0] === String(index + 1)).map(([code, name]) => [code, escape(name)]);
      return rows.length ? fold(t(label) + ' · ' + rows.length, table(t(label), [t('account'), t('accountName')], rows), !!normalized || index === 0) : '';
    }).join('');
    return `<div class="page-heading"><h1>${t('plan')}</h1></div><form class="filter-form" action="/accounts">
      <label>${t('search')}<input name="q" maxlength="80" value="${escape(query)}"></label>${chooseButton(t('filter'))}</form>
      ${tables ? `<div class="resources account-plan">${tables}</div>` : `<p class="empty">${t('noCases')}</p>`}
      <p class="muted"><a href="${lang === 'kk' ? accountsSource.replace('/rus/', '/kaz/') : accountsSource}">${t('source')}</a></p>`;
  }

  return { brief, work, result, plan };
}
