import market from './market-v1.mjs';
import { bi } from './academy.mjs';

export default {
  ...market,
  companyId: 'adal-cafe', caseId: 'cafe-register', company: 'ADAL Café', image: null,
  title: bi('Смена в кафе', 'Дәмхана ауысымы'),
  description: bi('Рассчитайте сдачу, примите частичный возврат и сравните X- и Z-отчёты кассы.', 'Қайтарым ақшаны есептеп, ішінара қайтарымды қабылдап, кассаның X және Z есептерін салыстырыңыз.'),
  opening: 10000,
  items: [
    { id: 'order', name: bi('Заказ на двоих', 'Екі адамға тапсырыс'), amount: 6100 },
    { id: 'bag', name: bi('Кофе в зёрнах', 'Дәнді кофе'), amount: 2650 }
  ],
  returnItem: 'bag', register: { tender: 10000 },
  steps: {
    ...market.steps,
    sale: { ...market.steps.sale, task: bi('Заказ стоит {sale}. Покупатель передал {tender}. Введите сдачу и оформите продажу.',
      'Тапсырыс құны {sale}. Сатып алушы {tender} берді. Қайтарым ақшаны енгізіп, сатылымды рәсімдеңіз.') },
    finish: { ...market.steps.finish, task: bi('Закройте учебную смену. Итоговый Z-отчёт сохранит оборот и остаток кассы.',
      'Оқу ауысымын жабыңыз. Қорытынды Z есебі касса айналымы мен қалдығын сақтайды.') }
  },
  keys: { ...market.keys, posting: { ...market.keys.posting, amount: 8750 } },
  documents: { ...market.documents, x: bi('X-отчёт', 'X есебі'), z: bi('Z-отчёт', 'Z есебі') }
};
