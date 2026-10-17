// Shared helpers for the site's forms: inline errors, validation rules and submission.
// Forms post JSON to PUBLIC_FORM_ENDPOINT when one is configured. Without one they run in demo mode:
// everything works on screen, but nothing leaves the browser.

export type Rule = (form: HTMLFormElement) => string | null;

const ERR_SUFFIX = '-err';

export function setError(field: HTMLElement | null, message: string | null): void {
  if (!field) return;
  const wrap = field.closest<HTMLElement>('[data-field]');
  const err = wrap?.querySelector<HTMLElement>('.field__error');
  if (message) {
    field.setAttribute('aria-invalid', 'true');
    if (err) {
      err.textContent = message;
      err.hidden = false;
      const describedBy = (field.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
      if (err.id && !describedBy.includes(err.id)) describedBy.push(err.id);
      field.setAttribute('aria-describedby', describedBy.join(' '));
    }
    wrap?.classList.add('has-error');
  } else {
    field.removeAttribute('aria-invalid');
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
    wrap?.classList.remove('has-error');
  }
}

export const digits = (s: string): string => s.replace(/\D/g, '');

export const rules = {
  required: (label: string) => (v: string) => (v.trim() ? null : label),
  name: (v: string) => (v.trim().length >= 2 ? null : 'Please enter your name.'),
  phone: (v: string) => {
    const d = digits(v);
    return d.length === 10 || (d.length === 11 && d.startsWith('1'))
      ? null
      : 'Enter a phone number we can reach you on, with area code.';
  },
  optionalEmail: (v: string) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'That email address doesn’t look right.'),
  email: (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter an email address we can reply to.'),
};

/** Run `checks` (field name -> validator) and return the first invalid element, or null. Errors are shown inline. */
export function runChecks(form: HTMLFormElement, checks: Record<string, (value: string) => string | null>): HTMLElement | null {
  let first: HTMLElement | null = null;
  for (const [name, check] of Object.entries(checks)) {
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!el) continue;
    const message = check(el.value ?? '');
    setError(el, message);
    if (message && !first) first = el;
  }
  return first;
}

export function clearOnInput(form: HTMLFormElement): void {
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t.getAttribute?.('aria-invalid') === 'true') setError(t, null);
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.getAttribute?.('aria-invalid') === 'true') setError(t, null);
  });
}

export interface SendResult {
  ok: boolean;
  demo: boolean;
}

/** POST the payload to the configured endpoint, or simulate a send in demo mode. */
export async function send(endpoint: string, payload: Record<string, unknown>): Promise<SendResult> {
  if (!endpoint) {
    await new Promise((r) => setTimeout(r, 700));
    return { ok: true, demo: true };
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, demo: false };
}

export function formData(form: HTMLFormElement): Record<string, unknown> {
  const fd = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    const all = fd.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export { ERR_SUFFIX };
