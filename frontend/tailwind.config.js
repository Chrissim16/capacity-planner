/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        mw: {
          // ── Brand ────────────────────────────────────────────────────────
          primary:       '#0089DD',
          'primary-light': '#E8F4FB',
          'primary-mid': '#4AADEA',
          'primary-hover': '#0078C4',
          dark:          '#003E65',
          'dark-hover':  '#002D4A',
          grey:          '#6C7A89',
          'grey-light':  '#E2ECF5',
          'grey-lighter':'#F5F8FC',
          // ── Dark-mode surfaces ────────────────────────────────────────────
          // These allow components to use tw classes like dark:bg-mw-surface-dark
          // instead of inline hex literals such as dark:bg-[#132133].
          'surface-dark':    '#132133',
          'card-border-dark':'#1E3550',
          'muted-dark':      '#1A2D45',
          'muted-border-dark':'#2A4A6B',
          'muted-text-dark': '#8BA8BF',
          'accent-text-dark':'#8DD0F5',
          'scrollbar-dark':  '#3A5B7B',
        },
        biz: {
          DEFAULT: '#7C3AED',
          light:   '#F5F3FF',
          mid:     '#EDE9FE',
          border:  '#C4B5FD',
          hover:   '#6D28D9',
          // dark-mode surfaces
          'surface-dark': '#2E1065',
          'text-dark':    '#C4B5FD',
        },
        util: {
          bench:   '#F5F8FC',
          healthy: '#0089DD',
          near:    '#D97706',
          over:    '#DC2626',
        },
      },
      fontSize: {
        xs:   ['11px', { lineHeight: '1.2'  }],
        sm:   ['12px', { lineHeight: '1.35' }],
        base: ['14px', { lineHeight: '1.5'  }],
        md:   ['15px', { lineHeight: '1.5'  }],
        lg:   ['16px', { lineHeight: '1.35' }],
        xl:   ['18px', { lineHeight: '1.35' }],
        '2xl':['22px', { lineHeight: '1.2'  }],
        '3xl':['28px', { lineHeight: '1.2'  }],
        '4xl':['36px', { lineHeight: '1.0'  }],
      },
      borderRadius: {
        card: '10px',
        sm:   '6px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
      },
      boxShadow: {
        sm:  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        md:  '0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
        lg:  '0 12px 40px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.08)',
        xl:  '0 24px 64px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.08)',
      },
      transitionDuration: {
        micro:    '0ms',
        fast:     '150ms',
        standard: '200ms',
        slow:     '300ms',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(1rem)' },
          to:   { opacity: '1', transform: 'translateX(0)'   },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(0.5rem)' },
          to:   { opacity: '1', transform: 'translateY(0)'      },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        shimmer:        'shimmer 1.5s infinite linear',
        'slide-in-right':'slide-in-right 0.2s ease-out',
        'slide-in-up':  'slide-in-up 0.15s ease-out',
        'fade-in':      'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
