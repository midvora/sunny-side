import { clearOnInput, formData, rules, runChecks, send, setError } from './forms';
import { coordText, explain, getFix, mapsLink } from './geolocate';

const form = document.querySelector<HTMLFormElement>('#request-form');

if (form) {
  const endpoint = form.dataset.endpoint ?? '';
  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')];
  const dots = [...form.querySelectorAll<HTMLElement>('[data-progress-step]')];
  const back = form.querySelector<HTMLButtonElement>('[data-back]')!;
  const next = form.querySelector<HTMLButtonElement>('[data-next]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const errorBox = form.querySelector<HTMLElement>('[data-form-error]')!;
  const success = form.querySelector<HTMLElement>('[data-success]')!;
  const demoNote = success.querySelector<HTMLElement>('[data-demo-note]')!;
  const live = form.querySelector<HTMLElement>('[data-live]')!;
  let index = 0;

  form.classList.add('is-js');
  back.hidden = false;
  next.hidden = false;

  const stepChecks: Array<() => HTMLElement | null> = [
    // step 1: what do you need?
    () => {
      const chosen = form.querySelector<HTMLInputElement>('input[name="need"]:checked');
      const anchor = form.querySelector<HTMLElement>('input[name="need"]')!;
      const msg = chosen ? null : 'Choose what you need so we can point you the right way.';
      const err = form.querySelector<HTMLElement>('#rf-need-err')!;
      err.textContent = msg ?? '';
      err.hidden = !msg;
      return msg ? anchor : null;
    },
    // step 2: equipment and what's happening
    () => {
      const first = runChecks(form, { equipment: rules.required('Pick the closest match for your equipment.') });
      const details = form.elements.namedItem('details') as HTMLTextAreaElement;
      const picked = form.querySelectorAll('input[name="symptoms"]:checked').length;
      const msg = picked || details.value.trim().length >= 4 ? null : 'Tell us what’s going on: pick an option above or write a few words.';
      setError(details, msg);
      return first ?? (msg ? details : null);
    },
    // step 3: where and how to reach you
    () => {
      const first = runChecks(form, {
        location: rules.required('Tell us where the truck is, or use the location button.'),
        name: rules.name,
        phone: rules.phone,
        email: rules.optionalEmail,
      });
      const consent = form.elements.namedItem('consent') as HTMLInputElement;
      const msg = consent.checked ? null : 'Please confirm it’s OK for us to contact you about this request.';
      setError(consent, msg);
      return first ?? (msg ? consent : null);
    },
  ];

  function show(i: number, moveFocus = true): void {
    index = i;
    steps.forEach((s, k) => (s.hidden = k !== i));
    dots.forEach((d, k) => {
      d.classList.toggle('is-current', k === i);
      d.classList.toggle('is-done', k < i);
      if (k === i) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    back.hidden = i === 0;
    next.hidden = i === steps.length - 1;
    submit.hidden = i !== steps.length - 1;
    live.textContent = `Step ${i + 1} of ${steps.length}`;
    if (moveFocus) {
      const legend = steps[i].querySelector<HTMLElement>('legend')!;
      legend.setAttribute('tabindex', '-1');
      legend.focus({ preventScroll: true });
      form!.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  next.addEventListener('click', () => {
    const bad = stepChecks[index]();
    if (bad) return void bad.focus();
    show(index + 1);
  });
  back.addEventListener('click', () => show(Math.max(0, index - 1)));
  clearOnInput(form);
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).name === 'need') {
      const err = form.querySelector<HTMLElement>('#rf-need-err')!;
      err.hidden = true;
      // Roadside: nudge toward calling, and pre-select an urgent description.
    }
  });

  // "Use my location"
  const locBtn = form.querySelector<HTMLButtonElement>('[data-share-location]');
  const locNote = form.querySelector<HTMLElement>('[data-location-note]');
  locBtn?.addEventListener('click', async () => {
    locBtn.disabled = true;
    const label = locBtn.textContent;
    locBtn.textContent = 'Finding you…';
    try {
      const fix = await getFix();
      const loc = form.elements.namedItem('location') as HTMLInputElement;
      loc.value = coordText(fix);
      (form.elements.namedItem('lat') as HTMLInputElement).value = String(fix.lat);
      (form.elements.namedItem('lon') as HTMLInputElement).value = String(fix.lon);
      (form.elements.namedItem('mapsLink') as HTMLInputElement).value = mapsLink(fix);
      setError(loc, null);
      if (locNote) locNote.textContent = 'Location added. If it looks off, you can edit it.';
    } catch (e) {
      if (locNote) locNote.textContent = explain((e as Error).message);
    } finally {
      locBtn.disabled = false;
      locBtn.textContent = label;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    for (let i = 0; i < stepChecks.length; i++) {
      const bad = stepChecks[i]();
      if (bad) {
        show(i, false);
        return void bad.focus();
      }
    }
    const data = formData(form);
    if (data.website) {
      // honeypot filled: look successful, do nothing
      return void finish(true, true);
    }
    delete data.website;
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Sending…';
    errorBox.hidden = true;
    try {
      const result = await send(endpoint, { ...data, submittedAt: new Date().toISOString(), page: location.href });
      if (!result.ok) throw new Error('send failed');
      finish(true, result.demo);
    } catch {
      errorBox.hidden = false;
      errorBox.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });

  function finish(ok: boolean, demo: boolean): void {
    if (!ok) return;
    const name = String(new FormData(form!).get('name') ?? '').trim().split(' ')[0];
    const nameEl = success.querySelector<HTMLElement>('[data-name]');
    if (nameEl) nameEl.textContent = name ? `, ${name}` : '';
    demoNote.hidden = !demo;
    steps.forEach((s) => (s.hidden = true));
    form!.querySelector<HTMLElement>('[data-progress]')!.hidden = true;
    form!.querySelector<HTMLElement>('[data-nav]')!.hidden = true;
    success.hidden = false;
    success.focus();
    success.scrollIntoView({ block: 'center' });
  }

  const need = new URLSearchParams(location.search).get('need');
  if (need) {
    const radio = form.querySelector<HTMLInputElement>(`input[name="need"][value="${CSS.escape(need)}"]`);
    if (radio) radio.checked = true;
  }

  show(0, false);
}
