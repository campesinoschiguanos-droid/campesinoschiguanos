/* Apply the saved theme before the stylesheets paint, then wire up the switch. */
(() => {
  const key = 'cc_theme_v1';
  let night = false;
  try { night = localStorage.getItem(key) === 'night'; } catch { /* Private browsing. */ }
  const root = document.documentElement;
  if (night) root.dataset.theme = 'night';

  const sync = () => {
    const switchButton = document.getElementById('themeSwitch');
    if (switchButton) {
      switchButton.setAttribute('aria-checked', String(night));
      switchButton.setAttribute('aria-label', night ? 'Activar modo día' : 'Activar modo noche');
    }
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = night ? '#10243A' : '#6E8B60';
  };

  document.addEventListener('DOMContentLoaded', () => {
    sync();
    document.getElementById('themeSwitch')?.addEventListener('click', () => {
      night = !night;
      if (night) root.dataset.theme = 'night';
      else delete root.dataset.theme;
      try { localStorage.setItem(key, night ? 'night' : 'day'); } catch { /* Theme still works. */ }
      sync();
    });
  });
})();
