/**
 * Rihla Design Tokens — Admin Panel
 *
 * All colors used across the app are defined here.
 * To change the look: edit this file only.
 *
 * Usage in Tailwind config:
 *   import { colors } from './src/theme';
 *   theme: { extend: { colors } }
 *
 * Usage in components (via Tailwind classes):
 *   bg-brand-500  text-brand-600  dark:bg-brand-400  etc.
 */

export const colors = {
  /** Primary brand color — sky blue */
  brand: {
    50:  '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // ← main brand
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  /** Success / active state — emerald */
  success: {
    50:  '#ecfdf5',
    100: '#d1fae5',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    900: '#064e3b',
  },
  /** Danger / destructive — red */
  danger: {
    50:  '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  /** Warning — amber */
  warning: {
    50:  '#fffbeb',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  /**
   * Neutral surface / text — slate
   * Light mode: bg-surface = white, bg-page = slate-50
   * Dark mode:  bg-surface = slate-900, bg-page = slate-950
   */
  surface: {
    50:  '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
};

/** Border radius tokens */
export const borderRadius = {
  card:   '0.75rem',  // rounded-xl  (12px)
  modal:  '1rem',     // rounded-2xl (16px)
  badge:  '9999px',   // rounded-full
  input:  '0.5rem',   // rounded-lg  (8px)
  button: '0.75rem',  // rounded-xl  (12px)
};

/** Shadow tokens */
export const boxShadow = {
  card:   '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
  modal:  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  button: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
};
