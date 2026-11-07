'use strict';

(() => {
  const themes = ['dark', 'light', 'amoled', 'cyber-blue', 'neon-purple'];
  const names = {
    dark: 'Dark',
    light: 'Light',
    amoled: 'AMOLED',
    'cyber-blue': 'Cyber Blue',
    'neon-purple': 'Neon Purple'
  };
  let current = 'dark';

  try {
    const saved = localStorage.getItem('tanjil-theme');
    if (themes.includes(saved)) current = saved;
  } catch {
    // Theme selection remains usable for the current page when storage is disabled.
  }

  function applyTheme(theme) {
    current = theme;
    document.body.dataset.theme = theme;
    document.body.classList.toggle('light-theme', theme === 'light');
    const button = document.getElementById('themeToggle');
    if (button) {
      button.textContent = theme === 'light' ? '☾' : theme === 'amoled' ? '◼' : '◐';
      button.setAttribute('aria-label', `Change theme. Current theme: ${names[theme]}`);
      button.title = `Theme: ${names[theme]} · click to change`;
    }
    try {
      localStorage.setItem('tanjil-theme', theme);
    } catch {
      // The selected theme still applies for this page.
    }
  }

  let themeButton = document.getElementById('themeToggle');
  if (!themeButton) {
    themeButton = document.createElement('button');
    themeButton.type = 'button';
    themeButton.id = 'themeToggle';
    themeButton.className = 'theme-toggle';
    document.body.append(themeButton);
  }
  themeButton.addEventListener('click', () => {
    const index = themes.indexOf(current);
    applyTheme(themes[(index + 1) % themes.length]);
  });
  applyTheme(current);

  if (!document.querySelector('.mobile-bottom-nav')) {
    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Quick navigation');
    const links = [
      ['/','⌂','Home'],
      ['/messenger.html','✉','Chat'],
      ['/challenges.html','⚑','Events'],
      ['/profile.html','◉','Profile']
    ];
    nav.innerHTML = links.map(([href, icon, label]) => {
      const active = location.pathname === href || (href === '/' && location.pathname === '/index.html');
      return `<a href="${href}"${active ? ' aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><small>${label}</small></a>`;
    }).join('');
    document.body.append(nav);
  }
})();
