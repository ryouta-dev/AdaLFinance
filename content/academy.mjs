export const bi = (ru, kk) => ({ ru, kk });

export const modules = {
  kassa: { brand: 'ADAL KASSA', title: bi('Кассовые операции', 'Кассалық операциялар') },
  account: { brand: 'ADAL ACCOUNT', title: bi('Бухгалтерский учёт', 'Бухгалтерлік есеп') },
  finance: { brand: 'ADAL FINANCE', title: bi('Финансы и отчётность', 'Қаржы және есептілік') },
  tax: { brand: 'ADAL TAX', title: bi('Налоги и декларации', 'Салықтар мен декларациялар') },
  audit: { brand: 'ADAL AI / AUDIT', title: bi('Аудит и этика', 'Аудит және этика') },
  analytics: { brand: 'ADAL ANALYTICS', title: bi('Диагностика и портфолио', 'Диагностика және портфолио') }
};

export const enterprises = [
  { id: 'adal-market', name: 'ADAL Market', module: 'kassa', kind: bi('Магазин', 'Дүкен'), icon: 'market', lead: bi('Продажа, возврат и сверка кассы', 'Сатылым, қайтарым және кассаны салыстыру') },
  { id: 'adal-factory', name: 'ADAL Factory', module: 'account', kind: bi('Производство', 'Өндіріс'), icon: 'factory', lead: bi('Документы, проводки и регистры', 'Құжаттар, жазбалар және тіркелімдер') },
  { id: 'adal-cafe', name: 'ADAL Café', module: 'kassa', kind: bi('Кафе', 'Дәмхана'), icon: 'cafe', lead: bi('Оплата, сдача и отчёты X и Z', 'Төлем, қайтарым ақша және X, Z есептері') },
  { id: 'adal-build', name: 'ADAL Build', module: 'finance', kind: bi('Строительство', 'Құрылыс'), icon: 'build', lead: bi('Баланс, расходы и прибыль проекта', 'Жоба балансы, шығыстары және пайдасы') },
  { id: 'adal-logistics', name: 'ADAL Logistics', module: 'tax', kind: bi('Логистика', 'Логистика'), icon: 'logistics', lead: bi('Расчёт НДС и проверка декларации', 'ҚҚС есептеу және декларацияны тексеру') },
  { id: 'adal-bank', name: 'ADAL Bank', module: 'finance', kind: bi('Банк', 'Банк'), icon: 'bank', lead: bi('Выписка и сверка банковского счёта', 'Үзінді көшірме және банк шотын салыстыру') },
  { id: 'adal-advisory', name: 'ADAL Advisory', module: 'audit', kind: bi('Консалтинг', 'Консалтинг'), icon: 'audit', lead: bi('Расследование и профессиональная этика', 'Тексеру және кәсіби этика') }
];

export const skills = {
  cash: bi('Касса и возвраты', 'Касса және қайтарымдар'),
  accounting: bi('Двойная запись', 'Қосарлы жазба'),
  reporting: bi('Финансовая отчётность', 'Қаржылық есептілік'),
  tax: bi('Налоговый расчёт', 'Салық есебі'),
  audit: bi('Проверка документов', 'Құжаттарды тексеру'),
  ethics: bi('Профессиональная этика', 'Кәсіби этика')
};

export const ranks = [
  { threshold: 0, name: bi('Стажёр', 'Тағылымгер') },
  { threshold: 2, name: bi('Ассистент', 'Ассистент') },
  { threshold: 4, name: bi('Специалист', 'Маман') },
  { threshold: 6, name: bi('Старший специалист', 'Аға маман') },
  { threshold: 8, name: bi('Аудитор', 'Аудитор') }
];

export const academy = { id: 'academy', name: 'ADAL Academy', module: 'analytics', kind: bi('Диагностика', 'Диагностика') };
export const company = id => [...enterprises, academy].find(item => item.id === id);
export const caseKey = item => `${item.companyId}/${item.caseId}`;
