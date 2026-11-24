import qrcode from 'qrcode-generator';
import { caseKey, enterprises, modules, skills } from '../content/academy.mjs';
import { team } from '../content/team.mjs';
import { people } from './auth.mjs';
import { escape, date, icon, money } from './views.mjs';
import { answerText, attemptURL, caseURL, fieldControls, platformText, table } from './lesson-views.mjs';
import { cupCases, portfolio, standings } from './analytics.mjs';

const symbols = {
  market: '<path d="M3 9h18l-2-5H5L3 9Zm2 0v11h14V9m-9 11v-6h4v6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  factory: '<path d="M3 20V10l6 3V9l6 4V7h4l2 13H3Zm4-3h2m3 0h2m3 0h1"/>',
  cafe: '<path d="M5 7h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V7Zm12 1h2a2 2 0 0 1 0 4h-2M3 20h17M8 4v1m5-1v1"/>',
  build: '<path d="M9 21V3m-6 4h18l-5-4H9L3 7Zm6 4 4 3-4 3m5-10v6l3 2 2-2v-3M5 21h8"/>',
  logistics: '<path d="M3 6h11v11H3V6Zm11 4h4l3 3v4h-7m-8 0a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0"/>',
  bank: '<path d="m2 8 10-5 10 5v2H2V8Zm2 12h16M6 10v7m4-7v7m4-7v7m4-7v7"/>',
  audit: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h6m-6 4h3m3 0 1 1 2-2"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>'
};

export function platformViews(lang, base) {
  const { copy, link, tx, badge } = base;
  const t = key => platformText(lang, key);
  const button = (title, quiet = false) => `<button class="button${quiet ? ' secondary' : ''}">${title}</button>`;
  const actionLink = (title, target, quiet = false) => `<a class="button${quiet ? ' secondary' : ''}" href="${target}">${title}</a>`;
  const byCase = (items, target) => items.filter(item => caseKey(item.config) === caseKey(target) && !item.state.cup);
  const resume = attempts => attempts.find(item => !item.finished_at && !item.state.cup);
  const symbol = id => icon(symbols[id], 'district-icon');
  const progress = (n, max) => `<progress value="${n}" max="${max}" aria-label="${n} / ${max}"></progress>`;
  const caseBank = values => values.map(config => [caseKey(config), config]);

  function city(user, cases, attempts) {
    const active = resume(attempts);
    const record = portfolio(attempts);
    const visited = new Set(record.records.filter(row => row.score.verified).map(row => row.attempt.config.companyId));
    const diagnostic = cases.find(item => item.diagnostic);
    const nextCompany = enterprises.find(enterprise => !visited.has(enterprise.id));
    const primary = active ? actionLink(t('resume'), attemptURL(active))
      : !record.diagnosis ? actionLink(t('diagnosticStart'), caseURL(diagnostic))
        : nextCompany ? actionLink(t('openCompany') + ' · ' + escape(nextCompany.name), '/company/' + nextCompany.id)
          : actionLink(tx('portfolio'), '/portfolio');
    const districts = enterprises.map(enterprise => {
      const count = cases.filter(item => item.companyId === enterprise.id).length;
      const selected = active?.config.companyId === enterprise.id;
      return `<li><a class="district${selected ? ' district-current' : ''}" href="/company/${enterprise.id}">
        <span class="district-glyph">${symbol(enterprise.icon)}</span><span><strong>${escape(enterprise.name)}</strong>
        <small>${copy(enterprise.kind)}</small></span><span class="district-description">${copy(enterprise.lead)}</span>
        <span class="district-count" aria-label="${t('exerciseSteps')}: ${count}">${count}</span>${icon(symbols.arrow, 'district-next')}</a></li>`;
    }).join('');
    const cityLead = `<article class="city-cover">
      <div class="city-intro"><h1>ADAL City</h1><p>${t('cityLead')}</p>
        <div class="actions">${primary}
        ${actionLink(tx('bank'), '/bank', true)}</div></div>
      <figure><img src="/assets/city.jpg" alt="" fetchpriority="high"></figure></article>`;
    const progressPane = `<aside class="city-aside">
      <div class="passport"><h2>${escape(user.name)}</h2><p>${tx('group')} <strong>${escape(user.classGroup ?? user.group)}</strong></p>
        <dl><div><dt>${t('rank')}</dt><dd>${copy(record.rank.name)}</dd></div>
        <div><dt>${t('verified')}</dt><dd>${visited.size} / ${enterprises.length}</dd></div></dl>
        ${progress(visited.size, enterprises.length)}
        <a href="/portfolio">${tx('portfolio')}</a></div>
      <div class="city-shortcuts"><a href="/team">${tx('teams')}${icon(symbols.arrow)}</a>
        <a href="/cup">${tx('cup')}${icon(symbols.arrow)}</a><a href="/accounts">${t('plan')}${icon(symbols.arrow)}</a></div></aside>`;
    return cityLead + `<div class="city-content"><section class="districts"><h2>${t('cityDirectory')}</h2><ul>${districts}</ul></section>${progressPane}</div>`;
  }

  function casesList(cases, attempts) {
    if (!cases.length) return `<p class="empty">${t('noCases')}</p>`;
    return `<ul class="case-directory">${cases.map(config => {
      const history = byCase(attempts, config);
      const active = resume(history);
      const completed = history.find(item => item.finished_at);
      return `<li><div><p class="case-metadata">${escape(config.company)} <span>${tx('caseVersion')} ${config.version}</span></p>
        <h3>${copy(config.title)}</h3><p class="muted">${copy(config.description)}</p></div>
        <div class="case-actions">${active ? link('continue', attemptURL(active)) : ''}
          ${actionLink(t('caseStart'), caseURL(config), !!active)}
          ${completed ? actionLink(tx('result'), attemptURL(completed), true) : ''}</div></li>`;
    }).join('')}</ul>`;
  }

  function company(enterprise, cases, attempts) {
    const module = modules[enterprise.module];
    const cover = cases.find(item => item.image === '/assets/market.jpg')?.image;
    return `<div class="workspace-head"><a href="/">${tx('city')}</a><span aria-hidden="true">/</span><span>${escape(enterprise.name)}</span></div>
      <section class="enterprise-cover${cover ? ' enterprise-cover-photo' : ''}"><div class="enterprise-ident"><div class="enterprise-mark">${enterprise.icon ? symbol(enterprise.icon) : 'ADAL'}</div>
      <div><h1>${escape(enterprise.name)}</h1><p>${copy(enterprise.lead ?? enterprise.kind)}</p><p class="enterprise-module">${module.brand}
      <span>${copy(module.title)}</span></p></div></div>${cover ? `<img src="${cover}" alt="" fetchpriority="high">` : ''}</section>
      <section class="archive"><h2>${t('companyCases')}</h2>${casesList(cases, attempts)}</section>
      <section class="archive"><h2>${tx('attempts')}</h2>${base.list(attempts, false)}</section>`;
  }

  function bank(cases, attempts, filter, search) {
    const query = search.trim().toLocaleLowerCase(lang);
    const visible = cases.filter(item => (!filter || (item.module ?? 'kassa') === filter) &&
      (item.title[lang] + ' ' + item.company + ' ' + item.description[lang]).toLocaleLowerCase(lang).includes(query));
    return `<div class="page-heading"><h1>${tx('bank')}</h1>${actionLink(t('plan'), '/accounts', true)}</div>
      <form class="filter-form" action="/bank"><label>${t('search')}<input type="search" name="q" maxlength="80" value="${escape(search)}"></label>
        <label>${t('module')}<select name="module"><option value="">${t('allModules')}</option>${Object.entries(modules).map(([key, item]) =>
          `<option value="${key}"${key === filter ? ' selected' : ''}>${item.brand} · ${copy(item.title)}</option>`).join('')}</select></label>${button(t('filter'))}</form>
      ${casesList(visible, attempts)}`;
  }

  function studentPortfolio(user, cases, attempts) {
    const record = portfolio(attempts);
    const diagnosis = cases.find(item => item.diagnostic);
    const diagnostics = record.diagnosis ? actionLink(t('diagnosticResult'), attemptURL(record.diagnosis), true) : actionLink(t('diagnosticStart'), caseURL(diagnosis));
    const categories = Object.entries(record.values).map(([id, result]) => {
      const baseline = record.baseline[id];
      const correct = baseline?.filter(item => item.status === 'right').length;
      return `<li><div><strong>${copy(skills[id])}</strong>
      <span>${result.maximum ? result.earned + ' / ' + result.maximum : t('noEvidence')}</span></div>
      ${progress(result.earned, result.maximum || 1)}
      ${baseline ? `<small>${t('diagnosticBaseline')} ${correct} / ${baseline.length}</small>` : ''}</li>`;
    }).join('');
    const proof = record.records.map(({ attempt, score }) => `<li><a href="${attemptURL(attempt)}">${copy(attempt.config.title)}</a>
      <span class="muted">${escape(attempt.config.company)}</span><strong>${score.earned} / ${score.maximum}</strong></li>`).join('');
    return `<div class="page-heading"><div><h1>${tx('portfolio')}</h1><p class="lead">${escape(user.name)}</p></div>${diagnostics}</div>
      <div class="portfolio-head"><div><span>${t('rank')}</span><strong>${copy(record.rank.name)}</strong>
        ${record.nextRank ? `<small>${t('nextRank')} ${record.nextRank.threshold - record.verified}</small>` : ''}</div>
        <div><span>${t('salary')}</span><strong>${money(record.salary)}</strong></div><div><span>${t('reputation')}</span><strong>${record.reputation}%</strong></div></div>
      <p class="portfolio-rules muted">${t('virtualRules')}</p>
      <div class="portfolio-grid"><section><h2>${t('map')}</h2><ul class="skill-map">${categories}</ul></section>
      <section><h2>${t('records')}</h2>${proof ? `<ul class="proof-list">${proof}</ul>` : `<p class="empty">${t('noEvidence')}</p>`}</section></div>
      <section class="archive"><h2>${tx('attempts')}</h2>${base.list(attempts, false)}</section>`;
  }

  function analytics(user, attempts, roster) {
    const ids = Object.keys(skills);
    const rows = roster.map(student => {
      const stats = portfolio(attempts.filter(item => item.owner === student.username));
      return [escape(student.name), copy(stats.rank.name), ...ids.map(id => {
        const value = stats.values[id];
        return value.maximum ? value.earned + ' / ' + value.maximum : '—';
      }), stats.diagnosis ? `<a href="${attemptURL(stats.diagnosis, true)}">${tx('details')}</a>` : '—'];
    });
    return `<div class="page-heading"><div><h1>${tx('analytics')}</h1><p class="lead">${tx('group')} ${escape(user.classGroup ?? user.group)}</p></div>${actionLink(t('download'), '/teacher/export')}</div>
      <section class="report-page"><h2>${t('groupMatrix')}</h2>${table(t('groupMatrix'), [t('studentName'), t('rank'), ...ids.map(id => copy(skills[id])), t('diagnostics')], rows)}</section>
      <section class="archive"><h2>${tx('attempts')}</h2>${base.list(attempts, true)}</section>`;
  }

  function builder(cases, selected, raw, message, error, advanced = false) {
    const chosen = cases.find(item => caseKey(item) === selected);
    const schema = chosen ? JSON.stringify(chosen, null, 2) : raw;
    const localized = ['caseTitle', 'caseDescription', 'casePrompt', 'caseHint', 'caseExplanation'].map(key => `<fieldset class="localized-pair">
      <legend>${t(key)}</legend>${['ru', 'kk'].map(language => `<label><span lang="${language}">${language === 'ru' ? 'Русский' : 'Қазақша'}</span>
      <textarea required maxlength="450" name="${key}-${language}" rows="2"></textarea></label>`).join('')}</fieldset>`).join('');
    const guided = `<details class="work-panel builder-panel"><summary>${t('guidedCase')}</summary>
      <form method="post" action="/teacher/builder" class="stack"><input type="hidden" name="request" value="${crypto.randomUUID()}">
      <input type="hidden" name="editor" value="guided"><div class="author-fields">
      <label>${t('enterprise')}<select name="companyId" required>${enterprises.map(enterprise => `<option value="${enterprise.id}">${escape(enterprise.name)}</option>`).join('')}</select></label>
      <label>${t('caseId')}<input name="caseId" required pattern="[a-z](?:[a-z0-9]|-){1,55}" maxlength="56"></label>
      <label>${t('map')}<select name="skill" required>${Object.entries(skills).map(([id, title]) => `<option value="${id}">${copy(title)}</option>`).join('')}</select></label>
      <label>${t('correctAmount')}<input name="expected" required pattern="-?[0-9]+" maxlength="13"></label></div>
      ${localized}${button(t('publish'))}</form></details>`;
    return `<div class="page-heading"><div><h1>${tx('builder')}</h1><p class="lead">${t('authorsLead')}</p></div></div>
      ${message ? `<p class="notice ${error ? 'alert' : 'success'}" role="status">${t(message)}</p>` : ''}
      <div class="builder-sections">${guided}<details class="work-panel builder-panel"${selected || error || advanced ? ' open' : ''}><summary>${t('advancedCase')}</summary>
      <form method="get" action="/teacher/builder" class="filter-form">
      <label>${t('template')}<select name="case"><option value="">${t('newTemplate')}</option>
      ${caseBank(cases).map(([key, item]) => `<option value="${escape(key)}"${key === selected ? ' selected' : ''}>${escape(item.company)} · ${copy(item.title)}</option>`).join('')}</select></label><input type="hidden" name="editor" value="advanced">${button(t('loadTemplate'), true)}</form>
      <form method="post" action="/teacher/builder" class="stack"><input type="hidden" name="request" value="${crypto.randomUUID()}">
      <input type="hidden" name="base" value="${escape(selected ?? '')}"><input type="hidden" name="version" value="${chosen?.version ?? 0}">
      <label>${t('caseJson')}<textarea name="schema" required maxlength="30000" rows="22" spellcheck="false">${escape(error ? raw : schema)}</textarea></label>
      ${button(t('publish'))}</form></details></div>`;
  }

  function qrPage(roster, data) {
    let generated = '';
    if (data) {
      const code = qrcode(0, 'M');
      code.addData(data.link);
      code.make();
      const svg = code.createSvgTag({ cellSize: 5, margin: 20, scalable: true, alt: 'QR' });
      generated = `<div class="qr-output"><div class="qr-art">${svg}</div><div><h2>${escape(data.person.name)}</h2>
        <p class="muted">${date(data.expires, lang)}</p>${actionLink(t('qrLink'), escape(data.link), true)}</div></div>`;
    }
    return `<div class="page-heading"><div><h1>${tx('qr')}</h1><p class="lead">${t('qrLead')}</p></div></div>
      <section class="work-panel qr-panel"><form method="post" action="/teacher/qr" class="filter-form">
        <label>${tx('student')}<select name="student" required><option value="">${tx('choose')}</option>
          ${roster.map(user => `<option value="${escape(user.username)}">${escape(user.name)}</option>`).join('')}</select></label>
        ${button(t('qrCreate'))}</form>${generated}</section>`;
  }

  function redeem(person) {
    return `<section class="work-panel qr-panel"><h1>${tx('qr')}</h1>${person ?
      `<p class="lead">${t('qrLeadIn')}</p><h2>${escape(person.name)}</h2><form method="post" class="actions">${button(tx('signIn'))}</form>` :
      `<p class="notice alert">${t('qrExpired')}</p>${actionLink(tx('signIn'), '/login', true)}`}</section>`;
  }

  function teamPage(entries, user) {
    const teacher = user.role === 'teacher';
    const latest = team.sections.map(section => entries.find(entry => entry.section === section.id));
    const ready = latest.every(item => item?.correct);
    const tasks = team.sections.map((section, index) => {
      const submitted = latest[index];
      return `<article class="team-section work-panel"><div class="score-line"><h2>${copy(section.title)}</h2>
        ${badge(submitted ? submitted.correct ? 'right' : 'error' : 'pending')}</div><p>${copy(section.task)}</p>
        ${submitted && !submitted.correct ? `<p class="notice alert">${copy(section.hint)}</p>` : ''}
        ${teacher ? '' : `<form method="post" action="/team" class="stack" data-draft="team/${user.username}/${section.id}/${submitted?.request_id ?? 0}"><input type="hidden" name="section" value="${section.id}">
          <input type="hidden" name="request" value="${crypto.randomUUID()}">${fieldControls(section.fields, section.id, submitted?.answers, undefined, lang, base)}
          ${button(t('submit'), !!submitted)}</form>`}</article>`;
    }).join('');
    const log = entries.map(entry => {
      const section = team.sections.find(item => item.id === entry.section);
      const answers = section.fields.map(field => answerText(field, entry.answers[field.id], copy)).join(' · ');
      return `<li><time>${date(entry.recorded_at, lang)}</time><div><strong>${escape(people[entry.username]?.name ?? entry.username)} · ${copy(section.title)}</strong>
        <p>${answers} · ${tx(entry.correct ? 'postingRight' : 'postingWrong')}</p></div></li>`;
    }).join('');
    return `<div class="page-heading"><div><h1>${copy(team.title)}</h1><p class="lead">${t('teamLead')}</p></div></div>
      <section class="team-summary"><dl>${team.evidence.map(([label, value], i) =>
        `<div><dt>${copy(label)}</dt><dd>${i === 2 ? money(value) : value + ' ' + t('noCurrency')}</dd></div>`).join('')}</dl>
      <p class="notice${ready ? ' success' : ''}">${t(ready ? 'teamConfirmed' : 'teamPending')}</p></section>
      <div class="team-grid">${tasks}</div><section class="work-panel timeline team-log"><h2>${t('teamLog')}</h2>
      ${log ? '<ol>' + log + '</ol>' : `<p class="muted">${t('noSubmissions')}</p>`}</section>`;
  }

  function cupPage(user, attempts, cases, roster) {
    const teacher = user.role === 'teacher';
    const places = standings(attempts, roster);
    const own = places.find(row => row.user.username === user.username);
    const rounds = cupCases.map((key, index) => {
      const config = cases.find(item => caseKey(item) === key);
      const current = own?.rounds[index];
      return `<article class="round"><span>${t('round')} ${index + 1}</span><h2>${copy(config.title)}</h2>
        <p class="muted">${escape(config.company)}</p>${teacher ? '' : current ?
          link(current.finished_at ? 'details' : 'continue', attemptURL(current), true) : actionLink(t('startRound'), caseURL(config, true))}</article>`;
    }).join('');
    const rows = places.filter(item => item.completed).map((item, index) => [index + 1, escape(item.user.name), item.earned, item.completed + ' / ' + cupCases.length, Math.round(item.time / 6000) / 10]);
    return `<div class="page-heading"><div><h1>${tx('cup')}</h1><p class="lead">${t('cupLead')}</p></div></div>
      <div class="cup-grid">${rounds}</div><p class="notice">${t('cupRules')}</p><section class="report-page"><h2>${t('ranking')}</h2>
      ${rows.length ? table(t('ranking'), ['#', t('studentName'), t('points'), t('completedRounds'), t('duration')], rows) : `<p class="empty">${t('noSubmissions')}</p>`}</section>`;
  }

  return { city, company, bank, studentPortfolio, analytics, builder, qrPage, redeem, teamPage, cupPage };
}
