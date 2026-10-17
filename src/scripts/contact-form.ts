import { clearOnInput, formData, rules, runChecks, send } from './forms';

const form = document.querySelector<HTMLFormElement>('#contact-form');

if (form) {
  const endpoint = form.dataset.endpoint ?? '';
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const errorBox = form.querySelector<HTMLElement>('[data-form-error]')!;
  const success = form.querySelector<HTMLElement>('[data-success]')!;
  const demoNote = success.querySelector<HTMLElement>('[data-demo-note]')!;
  clearOnInput(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const bad = runChecks(form, {
      name: rules.name,
      email: rules.email,
      phone: (v) => (v.trim() ? rules.phone(v) : null),
      message: (v) => (v.trim().length >= 5 ? null : 'Please write a short message so we know how to help.'),
    });
    if (bad) return void bad.focus();
    const data = formData(form);
    if (data.website) return;
    delete data.website;
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Sending…';
    errorBox.hidden = true;
    try {
      const result = await send(endpoint, { ...data, form: 'contact', submittedAt: new Date().toISOString(), page: location.href });
      if (!result.ok) throw new Error('send failed');
      demoNote.hidden = !result.demo;
      form.querySelector<HTMLElement>('[data-fields]')!.hidden = true;
      success.hidden = false;
      success.focus();
    } catch {
      errorBox.hidden = false;
      errorBox.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
