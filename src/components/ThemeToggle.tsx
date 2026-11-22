'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  LIGHT_SCHEME_QUERY,
  THEME_CHANGE_EVENT,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from '@/lib/theme';

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => readThemePreference(window.localStorage),
    () => 'system',
  );
}

function applyPreference(preference: ThemePreference) {
  const prefersLight = window.matchMedia?.(LIGHT_SCHEME_QUERY).matches ?? false;
  applyResolvedTheme(document.documentElement, resolveTheme(preference, prefersLight));
}

/**
 * Keeps <html data-theme> in sync after the inline script in the root layout has set it:
 * follows the OS setting while the preference is "system", and changes made in other tabs.
 */
export function ThemeController() {
  const preference = useThemePreference();

  useEffect(() => {
    applyPreference(preference);
    if (preference !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia(LIGHT_SCHEME_QUERY);
    const onChange = () => applyPreference('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  return null;
}

const LABELS: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' };

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (preference === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (preference === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/** System / Light / Dark switch. `compact` shows icons only (labels stay available to screen readers). */
export function ThemeToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const preference = useThemePreference();

  const choose = (next: ThemePreference) => {
    writeThemePreference(window.localStorage, next);
    applyPreference(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <div className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''} ${className}`.trim()} role="radiogroup" aria-label="Theme">
      {THEME_PREFERENCES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={preference === option}
          aria-label={compact ? `${LABELS[option]} theme` : undefined}
          title={`${LABELS[option]} theme`}
          className={`theme-toggle-option ${preference === option ? 'active' : ''}`}
          onClick={() => choose(option)}
        >
          <ThemeIcon preference={option} />
          {!compact && <span>{LABELS[option]}</span>}
        </button>
      ))}
    </div>
  );
}
