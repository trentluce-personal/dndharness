import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import SharedWorkspace from './SharedWorkspace.jsx';
import { ripple } from './ripple.js';
import useWorkspaceNavigation from './useWorkspaceNavigation.jsx';

function TableMark() {
  return (
    <svg viewBox="0 0 100 110" fill="none" aria-hidden="true">
      <path d="M50 5 94 30v50l-44 25L6 80V30L50 5Z" />
      <path d="m50 5 24 65H26L50 5ZM6 30l20 40-20 10m88-50L74 70l20 10M26 70l24 35 24-35M6 30l44 15 44-15" />
      <text x="50" y="64" textAnchor="middle">20</text>
    </svg>
  );
}

export default function App() {
  const navigation = useWorkspaceNavigation();
  const themeTransition = useRef(null);
  const [motion, setMotion] = useState(() => {
    try {
      const saved = localStorage.getItem('dndharness-motion');
      if (saved === 'full' || saved === 'reduce') return saved;
    } catch { /* Use the system preference when storage is unavailable. */ }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full';
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = motion;
    try { localStorage.setItem('dndharness-motion', motion); } catch { /* Session-only preference. */ }
  }, [motion]);
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('dndharness-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dndharness-theme', theme);
    } catch {
      // Keep the chosen theme for this session if storage is unavailable.
    }
  }, [theme]);

  function toggleTheme(event) {
    const changeTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');
    if (motion === 'reduce') {
      changeTheme();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.style.setProperty('--theme-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-y', `${y}px`);
    document.documentElement.style.setProperty('--theme-radius', `${radius + 10}px`);
    const pulse = () => {
      document.querySelectorAll('.theme-pulse').forEach((node) => node.remove());
      const halo = document.createElement('span');
      halo.className = 'theme-pulse';
      halo.setAttribute('aria-hidden', 'true');
      halo.style.left = `${x}px`;
      halo.style.top = `${y}px`;
      document.body.append(halo);
      const animation = halo.animate([
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: .85 },
        { transform: 'translate(-50%, -50%) scale(2.7)', opacity: 0 },
      ], { duration: 950, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      animation.finished.then(() => halo.remove(), () => halo.remove());
    };
    if (!document.startViewTransition) {
      changeTheme();
      pulse();
      return;
    }
    themeTransition.current?.skipTransition();
    themeTransition.current = document.startViewTransition(() => flushSync(changeTheme));
    themeTransition.current.ready.then(pulse, () => {});
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="dndharness home">
          <span className="brand-mark"><TableMark /></span>
          <span className="brand-name">dnd<span>harness</span></span>
        </a>
        <div className="header-actions">
          <button className="motion-toggle" type="button" aria-pressed={motion === 'full'}
            onClick={() => setMotion((current) => current === 'full' ? 'reduce' : 'full')}>
            {motion === 'full' ? 'Motion on' : 'Enable animations'}
          </button>
          <button
            className="theme-toggle"
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onPointerDown={ripple}
            onKeyDown={(event) => {
              if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) ripple(event);
            }}
            onClick={toggleTheme}
          >
            <svg key={theme} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {theme === 'dark' ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                </>
              ) : (
                <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
              )}
            </svg>
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <SharedWorkspace navigation={navigation} />
      </main>

      <footer><span>dndharness</span><span>Built for the stories you tell together.</span></footer>
    </div>
  );
}
