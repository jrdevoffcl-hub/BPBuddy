(() => {
  'use strict';

  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#primary-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  const updateConnection = () => {
    const el = document.getElementById('connection-status');
    if (!el) return;
    const online = navigator.onLine;
    el.textContent = online ? 'Online' : 'Offline — local records available';
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
  };
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  updateConnection();

  const userButton = document.getElementById('user-menu-button');
  const userMenu = document.getElementById('user-menu');
  if (userButton && userMenu) {
    const closeMenu = () => {
      userMenu.hidden = true;
      userButton.setAttribute('aria-expanded', 'false');
    };
    userButton.addEventListener('click', event => {
      event.stopPropagation();
      const open = userMenu.hidden;
      userMenu.hidden = !open;
      userButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', event => {
      if (!userMenu.contains(event.target) && event.target !== userButton) closeMenu();
    });
  }

  document.querySelectorAll('#logout-button, #profile-logout').forEach(button => {
    button.addEventListener('click', () => window.BPBuddyAuth?.logout());
  });

  const setActiveSidebar = () => {
    const links = [...document.querySelectorAll('.app-sidebar nav a[href^="#"]')];
    if (!links.length) return;
    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
    }, {rootMargin: '-20% 0px -65% 0px', threshold: [0, .2, .6]});
    sections.forEach(section => observer.observe(section));
  };
  setActiveSidebar();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
