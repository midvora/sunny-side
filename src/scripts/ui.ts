import { statusAt, zoned, type Hours } from '../lib/hours';

const doc = document;
doc.documentElement.classList.add('js');

// ---- sticky header shadow ----
const header = doc.querySelector<HTMLElement>('[data-header]');
if (header) {
  const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

// ---- desktop dropdowns and the services mega menu ----
const navItems = [...doc.querySelectorAll<HTMLElement>('[data-nav-item]')];
const toggleOf = (item: HTMLElement) => item.querySelector<HTMLButtonElement>('.nav__toggle')!;
function setOpen(item: HTMLElement, open: boolean): void {
  const btn = toggleOf(item);
  const panel = doc.getElementById(btn.getAttribute('aria-controls')!);
  btn.setAttribute('aria-expanded', String(open));
  if (panel) panel.hidden = !open;
  item.classList.toggle('is-open', open);
}
const closeAll = (except?: HTMLElement) => navItems.forEach((i) => i !== except && setOpen(i, false));

const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
// Escape dismisses a menu even while the pointer rests on it: cancel any pending hover-open and ignore hover until the pointer leaves.
const hoverTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
const dismissed = new Set<HTMLElement>();
for (const item of navItems) {
  toggleOf(item).addEventListener('click', () => {
    const open = toggleOf(item).getAttribute('aria-expanded') === 'true';
    closeAll(item);
    setOpen(item, !open);
  });
  item.addEventListener('focusout', (e) => {
    if (!item.contains((e as FocusEvent).relatedTarget as Node | null)) setOpen(item, false);
  });
  if (finePointer) {
    item.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimers.get(item));
      if (dismissed.has(item)) return;
      hoverTimers.set(item, setTimeout(() => {
        closeAll(item);
        setOpen(item, true);
      }, 90));
    });
    item.addEventListener('mouseleave', () => {
      dismissed.delete(item);
      clearTimeout(hoverTimers.get(item));
      hoverTimers.set(item, setTimeout(() => setOpen(item, false), 180));
    });
  }
}
doc.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = navItems.find((i) => i.classList.contains('is-open'));
  if (open) {
    clearTimeout(hoverTimers.get(open));
    dismissed.add(open);
    setOpen(open, false);
    toggleOf(open).focus();
  }
});
doc.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('[data-nav-item]')) closeAll();
});

// ---- mobile drawer ----
const drawer = doc.getElementById('drawer') as HTMLDialogElement | null;
if (drawer) {
  const openers = [...doc.querySelectorAll<HTMLElement>('[data-drawer-open]')];
  openers.forEach((b) =>
    b.addEventListener('click', () => {
      drawer.showModal();
      b.setAttribute('aria-expanded', 'true');
    }),
  );
  doc.querySelectorAll('[data-drawer-close]').forEach((b) => b.addEventListener('click', () => drawer.close()));
  drawer.addEventListener('close', () => {
    openers.forEach((b) => b.setAttribute('aria-expanded', 'false'));
    openers[0]?.focus();
  });
  drawer.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) drawer.close();
  });
  matchMedia('(min-width: 1060px)').addEventListener('change', (m) => m.matches && drawer.open && drawer.close());
}

// ---- open / closed status and today's row ----
const hoursEl = doc.getElementById('hours-data');
if (hoursEl?.textContent) {
  const hours = JSON.parse(hoursEl.textContent) as Hours;
  const update = () => {
    const now = new Date();
    const s = statusAt(now, hours);
    doc.querySelectorAll('[data-open-status]').forEach((el) => (el.textContent = s.text));
    doc.querySelectorAll('[data-open-dot]').forEach((el) => el.classList.toggle('is-open', s.open));
    const { day } = zoned(now, hours.tz);
    doc.querySelectorAll<HTMLElement>('tr[data-day]').forEach((tr) => {
      const today = tr.dataset.day === day;
      tr.classList.toggle('is-today', today);
      if (today) tr.setAttribute('aria-current', 'date');
      else tr.removeAttribute('aria-current');
    });
  };
  update();
  setInterval(update, 60_000);
}

// ---- reveal on scroll (only for content below the fold, and never with reduced motion) ----
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
  );
  doc.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top > innerHeight) {
      el.classList.add('reveal');
      io.observe(el);
    }
  });
}
