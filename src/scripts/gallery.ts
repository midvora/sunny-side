const grid = document.querySelector<HTMLElement>('[data-gallery]');
const dialog = document.getElementById('lightbox') as HTMLDialogElement | null;

if (grid && dialog) {
  const items = [...grid.querySelectorAll<HTMLButtonElement>('[data-gallery-item]')];
  const img = dialog.querySelector<HTMLImageElement>('[data-lb-img]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-lb-caption]')!;
  const counter = dialog.querySelector<HTMLElement>('[data-lb-count]')!;
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  let current = 0;

  const visible = () => items.filter((i) => !i.closest<HTMLElement>('[data-gallery-cell]')!.hidden);

  function render(): void {
    const list = visible();
    const b = list[current];
    if (!b) return;
    img.src = b.dataset.full!;
    img.alt = b.dataset.alt ?? '';
    caption.textContent = b.dataset.caption ?? '';
    counter.textContent = `${current + 1} of ${list.length}`;
  }
  function step(delta: number): void {
    const n = visible().length;
    current = (current + delta + n) % n;
    render();
  }

  items.forEach((b) =>
    b.addEventListener('click', () => {
      current = visible().indexOf(b);
      render();
      dialog.showModal();
    }),
  );
  dialog.querySelector('[data-lb-prev]')!.addEventListener('click', () => step(-1));
  dialog.querySelector('[data-lb-next]')!.addEventListener('click', () => step(1));
  dialog.querySelector('[data-lb-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // click on the backdrop
  });
  dialog.addEventListener('close', () => img.removeAttribute('src'));

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const f = chip.dataset.filter!;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      items.forEach((b) => {
        const cell = b.closest<HTMLElement>('[data-gallery-cell]')!;
        cell.hidden = f !== 'all' && b.dataset.cat !== f;
      });
    }),
  );
}
