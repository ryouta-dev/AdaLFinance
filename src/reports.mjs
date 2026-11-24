import { accountByCode } from '../content/accounts.mjs';

export function trialBalance(opening, entries) {
  const balances = new Map();
  function row(code) {
    if (!balances.has(code)) balances.set(code, { code, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0 });
    return balances.get(code);
  }
  for (const [code, debit, credit] of opening) {
    row(code).openingDebit += debit;
    row(code).openingCredit += credit;
  }
  for (const { debit, credit, amount } of entries) {
    row(debit).debit += amount;
    row(credit).credit += amount;
  }
  return [...balances.values()].sort((a, b) => a.code.localeCompare(b.code)).map(item => {
    const closing = item.openingDebit - item.openingCredit + item.debit - item.credit;
    return { ...item, closingDebit: Math.max(closing, 0), closingCredit: Math.max(-closing, 0) };
  });
}

export function trialTotals(rows) {
  const total = { openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 };
  for (const row of rows) for (const key of Object.keys(total)) total[key] += row[key];
  return total;
}

export function financialStatements(rows) {
  const report = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 };
  for (const row of rows) {
    const type = accountByCode[row.code]?.type;
    if (!type) continue;
    const debitBalance = row.closingDebit - row.closingCredit;
    report[type] += ['asset', 'expense'].includes(type) ? debitBalance : -debitBalance;
  }
  const profit = report.income - report.expense;
  return { ...report, profit, closingEquity: report.equity + profit, difference: report.asset - report.liability - report.equity - profit };
}

export function vatSummary({ rate, sales, purchases }) {
  const vat = amount => Math.round(amount * rate / 100);
  const salesBase = sales.reduce((sum, item) => sum + item.base, 0);
  const outputVat = sales.reduce((sum, item) => sum + vat(item.base), 0);
  const inputVat = purchases.filter(item => item.verified).reduce((sum, item) => sum + vat(item.base), 0);
  return { salesBase, outputVat, inputVat, payable: outputVat - inputVat };
}
