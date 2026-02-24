import type { Config } from 'tailwindcss'
import { colors, borderRadius, boxShadow } from './src/theme'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand:   colors.brand,
        success: colors.success,
        danger:  colors.danger,
        warning: colors.warning,
        surface: colors.surface,
      },
      borderRadius: {
        card:   borderRadius.card,
        modal:  borderRadius.modal,
        badge:  borderRadius.badge,
        input:  borderRadius.input,
        btn:    borderRadius.button,
      },
      boxShadow: {
        card:   boxShadow.card,
        modal:  boxShadow.modal,
        btn:    boxShadow.button,
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
