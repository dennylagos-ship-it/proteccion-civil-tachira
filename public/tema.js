const root = document.documentElement;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const photoOrder = [2, 4, 7, 11, 3, 12, 5, 9, 1, 8, 10, 6];
let preference;
try { preference = localStorage.getItem('pc-tachira-theme'); } catch {}

function applyTheme() {
  const dark = preference ? preference === 'dark' : systemTheme.matches;
  root.dataset.theme = dark ? 'dark' : 'light';
  const toggle = document.querySelector('#theme-toggle');
  if (toggle) {
    toggle.textContent = dark ? 'Tema claro' : 'Tema oscuro';
    toggle.hidden = false;
  }
}

applyTheme();
systemTheme.addEventListener('change', applyTheme);
function markCurrentPage() {
  const route = location.pathname === '/' ? '/' + (location.hash || '#inicio') : location.pathname;
  document.querySelectorAll('.portal-nav a').forEach(link => {
    if (link.getAttribute('href') === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', markCurrentPage);
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  markCurrentPage();
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('pc-tachira-theme', preference); } catch {}
    applyTheme();
  });
});

class FondoOperativos extends HTMLElement {
  connectedCallback() {
    this.replaceChildren();
    const layer = document.createElement('div');
    layer.className = 'hero-photo-layer';
    layer.setAttribute('aria-hidden', 'true');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'hero-motion-toggle';
    let paused = false;
    let index = 0;
    let loading = false;
    const makePhoto = (number) => {
      const photo = new Image();
      photo.alt = '';
      photo.src = '/operativos/' + String(number).padStart(2, '0') + '.png';
      return photo;
    };
    const updateToggle = () => {
      toggle.textContent = paused ? '▶' : 'Ⅱ';
      toggle.setAttribute('aria-label', paused ? 'Reanudar fondo animado' : 'Pausar fondo animado');
    };
    toggle.addEventListener('click', () => {
      paused = !paused;
      updateToggle();
    });
    updateToggle();
    layer.append(makePhoto(photoOrder[index]));
    this.append(layer, toggle);
    this.rotation = setInterval(async () => {
      if (paused || reducedMotion.matches || document.hidden || loading) return;
      index = (index + 1) % photoOrder.length;
      loading = true;
      const photo = makePhoto(photoOrder[index]);
      try {
        await photo.decode();
        if (paused || reducedMotion.matches || !layer.isConnected) return;
        const previous = layer.lastElementChild;
        layer.append(photo);
        const transition = photo.animate([{opacity: 0}, {opacity: .44}], {duration: 1100, easing: 'ease-in-out'});
        await transition.finished;
        previous.remove();
      } catch {
        // Keep showing the previous photo if this one fails to load.
      } finally {
        loading = false;
      }
    }, 6500);
  }

  disconnectedCallback() {
    clearInterval(this.rotation);
  }
}

customElements.define('fondo-operativos', FondoOperativos);
