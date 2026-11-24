import { company, skills } from '../content/academy.mjs';
import { accountByCode } from '../content/accounts.mjs';

const slug = /^[a-z][a-z0-9-]{1,55}$/;
const fieldId = /^[a-z][a-zA-Z0-9]{0,35}$/;
const nonempty = (text, max) => typeof text === 'string' && text.trim().length > 0 && text.length <= max;
const localized = (text, max = 1000) => text && nonempty(text.ru, max) && nonempty(text.kk, max);
const value = amount => Number.isSafeInteger(amount) && Math.abs(amount) < 1e12;
const positive = amount => value(amount) && amount >= 0;
const account = code => typeof code === 'string' && Object.hasOwn(accountByCode, code);
const unique = list => new Set(list).size === list.length;
const table = (items, length, valid) => Array.isArray(items) && items.length <= length && items.every(valid);

function validField(field) {
  if (!field || !fieldId.test(field.id ?? '') || !localized(field.label, 120)) return false;
  if (field.kind === 'number' || field.kind === 'account') return true;
  return field.kind === 'choice' && table(field.options, 10, option => option && slug.test(option.id ?? '') && localized(option.label, 240))
    && field.options.length >= 2 && unique(field.options.map(option => option.id));
}

function validTask(item) {
  return item && slug.test(item.id ?? '') && localized(item.title, 100) && localized(item.prompt, 1500) &&
    localized(item.hint, 700) && localized(item.explanation, 900) && Object.hasOwn(skills, item.skill) &&
    table(item.fields, 6, validField) && item.fields.length > 0 && unique(item.fields.map(field => field.id)) &&
    item.key && Object.keys(item.key).length === item.fields.length && item.fields.every(field => {
      const expected = item.key[field.id];
      if (field.kind === 'number') return value(expected);
      if (field.kind === 'account') return account(expected);
      return field.options.some(option => option.id === expected);
    }) && (!item.post || (nonempty(item.post, 40) && item.fields.length === 3 && account(item.key.debit)
      && account(item.key.credit) && item.key.debit !== item.key.credit && positive(item.key.amount) && item.key.amount > 0));
}

function validVat(input) {
  return input && value(input.rate) && input.rate >= 0 && input.rate <= 100 && nonempty(input.period, 28) &&
    table(input.sales, 30, row => row && nonempty(row.id, 40) && positive(row.base)) &&
    table(input.purchases, 30, row => row && nonempty(row.id, 40) && positive(row.base) && typeof row.verified === 'boolean') &&
    ['salesBase', 'outputVat', 'inputVat', 'payable'].every(key => value(input.submitted?.[key]));
}

export function parseCase(raw) {
  let item;
  try { item = JSON.parse(raw); } catch { return { error: 'jsonError' }; }
  const enterprise = company(item?.companyId);
  if (!enterprise || !slug.test(item.caseId ?? '') || !localized(item.title, 110) || !localized(item.description, 480)
    || item.flow !== 'lesson' || !table(item.steps, 16, validTask) || !item.steps.length || !unique(item.steps.map(step => step.id))) {
    return { error: 'caseSchemaError' };
  }
  if (item.accounts && (!table(item.accounts, 70, account) || !item.accounts.length || !unique(item.accounts))) return { error: 'caseSchemaError' };
  if (item.accounts && item.steps.some(step => step.fields.some(field => field.kind === 'account' && !item.accounts.includes(step.key[field.id])))) {
    return { error: 'caseSchemaError' };
  }
  if (item.documents && !table(item.documents, 24, doc => doc && nonempty(doc.id, 50) && localized(doc.title, 120) &&
    table(doc.rows, 25, row => row && localized(row.label, 150) && (value(row.value) || nonempty(row.value, 500) || localized(row.value, 500))))) return { error: 'caseSchemaError' };
  if (item.opening && !table(item.opening, 45, row => Array.isArray(row) && row.length === 3 && account(row[0]) && positive(row[1]) && positive(row[2]))) return { error: 'caseSchemaError' };
  if (item.ledger && !table(item.ledger, 55, row => row && account(row.debit) && account(row.credit) && row.debit !== row.credit && positive(row.amount) && nonempty(row.doc, 45))) {
    return { error: 'caseSchemaError' };
  }
  if (item.artifact && !(item.artifact === 'finance' && item.opening && item.ledger || item.artifact === 'tax' && validVat(item.taxInputs))) {
    return { error: 'caseSchemaError' };
  }
  if (item.event && !localized(item.event) || item.assumption && !localized(item.assumption)) return { error: 'caseSchemaError' };
  const { companyId, caseId, title, description, steps, opening, ledger, documents, artifact, taxInputs, event, assumption, accounts } = item;
  return {
    config: { companyId, caseId, title, description, steps, opening, ledger, documents, artifact, taxInputs, event, assumption, accounts,
      flow: 'lesson', company: enterprise.name, module: enterprise.module, ...(companyId === 'academy' ? { diagnostic: true } : {}) }
  };
}
