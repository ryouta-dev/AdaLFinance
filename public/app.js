for (const form of document.querySelectorAll('[data-draft]')) {
  const key = `adal/draft/${form.dataset.draft}`;
  const fields = form.querySelectorAll('select, textarea, input:not([type=hidden])');
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || '{}');
    for (const field of fields) {
      if (Object.hasOwn(draft, field.name)) field.value = draft[field.name];
    }
    form.addEventListener('input', () => {
      const values = Object.fromEntries(Array.from(fields, field => [field.name, field.value]));
      try { sessionStorage.setItem(key, JSON.stringify(values)); } catch { /* Storage can be disabled. */ }
    });
    if (form.elements.action?.value === 'mentor') {
      form.addEventListener('submit', () => {
        try { sessionStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
      });
    }
  } catch { /* The form also works without local drafts. */ }
}
