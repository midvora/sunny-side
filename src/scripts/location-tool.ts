import { coordText, explain, getFix, mapsLink, type Fix } from './geolocate';

const tool = document.querySelector<HTMLElement>('[data-location-tool]');

if (tool) {
  const btn = tool.querySelector<HTMLButtonElement>('[data-locate]')!;
  const status = tool.querySelector<HTMLElement>('[data-locate-status]')!;
  const result = tool.querySelector<HTMLElement>('[data-locate-result]')!;
  const coords = tool.querySelector<HTMLElement>('[data-locate-coords]')!;
  const open = tool.querySelector<HTMLAnchorElement>('[data-locate-open]')!;
  const sms = tool.querySelector<HTMLAnchorElement>('[data-locate-sms]')!;
  const copy = tool.querySelector<HTMLButtonElement>('[data-locate-copy]')!;
  const smsNumber = tool.dataset.sms ?? '';
  let text = '';

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'Finding your location…';
    result.hidden = true;
    try {
      const fix: Fix = await getFix();
      text = `${coordText(fix)} ${mapsLink(fix)}`;
      coords.textContent = coordText(fix);
      open.href = mapsLink(fix);
      sms.href = `sms:${smsNumber}?&body=${encodeURIComponent(`Roadside help needed. My location: ${mapsLink(fix)}`)}`;
      result.hidden = false;
      status.textContent = 'Got it. Read this to us on the phone, or send it with the buttons below.';
    } catch (e) {
      status.textContent = explain((e as Error).message);
    } finally {
      btn.disabled = false;
    }
  });

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Press and hold to copy';
    }
    setTimeout(() => (copy.textContent = 'Copy location'), 2500);
  });
}
