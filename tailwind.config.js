module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--bg-base-rgb) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
        overlay: 'rgb(var(--bg-overlay-rgb) / <alpha-value>)',
        primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        warm: 'rgb(var(--accent-warm-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        insetSoft: 'inset 0 1px 0 rgba(255,255,255,0.03), inset -1px 0 0 rgba(255,255,255,0.02)',
        panel: '0 18px 60px rgba(0,0,0,0.35)',
      },
      transitionDuration: {
        150: '150ms',
      },
      animation: {
        pulseSoft: 'pulseSoft 1.2s ease-in-out infinite',
        modalRise: 'modalRise 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
        modalRise: {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
