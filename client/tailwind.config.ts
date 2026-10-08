import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          'green-950': 'var(--color-green-950)',
          'green-900': 'var(--color-green-900)',
          'green-800': 'var(--color-green-800)',
          'green-700': 'var(--color-green-700)',
          'green-600': 'var(--color-green-600)',
          'cream-50': 'var(--color-cream-50)',
          'cream-100': 'var(--color-cream-100)',
          'cream-200': 'var(--color-cream-200)',
          'cream-300': 'var(--color-cream-300)',
          'cream-400': 'var(--color-cream-400)',
          'gold-400': 'var(--color-gold-400)',
          'gold-500': 'var(--color-gold-500)',
          'gold-600': 'var(--color-gold-600)',
          'ink-900': 'var(--color-ink-900)',
          'ink-800': 'var(--color-ink-800)',
          'ink-700': 'var(--color-ink-700)',
          'ink-500': 'var(--color-ink-500)',
          'ink-400': 'var(--color-ink-400)',
          'ink-200': 'var(--color-ink-200)',
        },
        semantic: {
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          warning: 'var(--color-warning)',
          'warning-bg': 'var(--color-warning-bg)',
          danger: 'var(--color-danger)',
          'danger-bg': 'var(--color-danger-bg)',
          info: 'var(--color-info)',
          'info-bg': 'var(--color-info-bg)',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Poppins', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        script: ['Caveat', 'cursive'],
      },
      fontSize: {
        display: ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        h1: ['clamp(2rem, 3.5vw, 2.75rem)', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        h2: ['clamp(1.5rem, 2.5vw, 2rem)', { lineHeight: '1.25' }],
        h3: ['clamp(1.25rem, 2vw, 1.5rem)', { lineHeight: '1.3' }],
        h4: ['1.125rem', { lineHeight: '1.4' }],
        body: ['1rem', { lineHeight: '1.5' }],
        small: ['0.875rem', { lineHeight: '1.4' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        card: '16px',
        'card-sm': '12px',
        btn: '9999px',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(11, 61, 36, 0.06)',
        'soft-md': '0 4px 16px rgba(11, 61, 36, 0.09)',
        'soft-lg': '0 8px 30px rgba(11, 61, 36, 0.12)',
        'dark-card': '0 4px 20px rgba(0, 0, 0, 0.25)',
      },
      maxWidth: {
        content: '1200px',
      },
      transitionDuration: {
        base: '180ms',
      },
    },
  },
  plugins: [],
};

export default config;
