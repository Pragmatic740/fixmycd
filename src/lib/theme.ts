/**
 * Light / dark theme preference.
 *
 * The preference ('system', 'light' or 'dark') is kept in localStorage. The resolved
 * theme is written to <html data-theme="…"> by a small inline script before the first
 * paint (so there is no flash of the wrong theme), and kept in sync by ThemeController.
 * Kept free of React so it can be unit tested.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fmd-theme';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';
/** Fired on window when the preference changes in this tab. */
export const THEME_CHANGE_EVENT = 'fmd-theme-change';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage can throw in private mode or when site data is blocked.
    return 'system';
  }
}

export function writeThemePreference(storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined, preference: ThemePreference): void {
  try {
    if (preference === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted; the choice still applies to this page.
  }
}

export function applyResolvedTheme(root: { dataset: DOMStringMap; style: { colorScheme: string } }, theme: ResolvedTheme): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/**
 * Inline script for <head>. It must stay self-contained (no imports), so it repeats the
 * rules above; tests/unit/theme.test.ts checks that the two agree.
 */
export const themeInitScript = `(function(){try{var p=null;try{p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(p!=='light'&&p!=='dark'){p=window.matchMedia&&window.matchMedia(${JSON.stringify(LIGHT_SCHEME_QUERY)}).matches?'light':'dark'}var r=document.documentElement;r.dataset.theme=p;r.style.colorScheme=p}catch(e){}})();`;
