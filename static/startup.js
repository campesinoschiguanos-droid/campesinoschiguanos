/* Each page opening starts at Inicio; in-page navigation still uses anchors. */
(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const startAtHome = () => {
    const url = new URL(location.href);
    url.hash = 'inicio';
    history.replaceState(history.state, '', url);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };
  startAtHome();
  window.addEventListener('pageshow', startAtHome);
})();
