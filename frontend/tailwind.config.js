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
        sans:    ['DM Sans', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      colors: {
        // ── Sana Labs design tokens ───────────────────────────────────────────
        sana: {
          // Backgrounds
          'bg':           '#FAF9F7',
          'bg-secondary': '#F5F3F0',
          'bg-card':      '#FFFFFF',
          'bg-highlight': '#E8F8F8',
          'bg-alt':       '#FFF7ED',
          // Text
          'text':         '#1A1A1A',
          'text-muted':   '#6B7280',
          'text-faint':   '#9CA3AF',
          // Accents
          'teal':         '#0ED3CF',
          'teal-light':   '#CCFBF1',
          'orange':       '#F97316',
          'orange-light': '#FED7AA',
          'coral':        '#FB7185',
          'magenta':      '#D946EF',
          // Borders
          'border':       '#E5E5E3',
          'border-light': '#F0EFED',
        },
        // ── BIZ track — preserved for dual IT/BIZ data model ─────────────────
        biz: {
          DEFAULT: '#7C3AED',
          light:   '#F5F3FF',
          mid:     '#EDE9FE',
          border:  '#C4B5FD',
          hover:   '#6D28D9',
        },
        // ── Semantic ──────────────────────────────────────────────────────────
        util: {
          bench:   '#F5F3F0',
          healthy: '#22C55E',
          near:    '#F97316',
          over:    '#EF4444',
        },
        // ── Legacy mw-* aliases — kept for gradual migration ─────────────────
        // Components still using mw-* classes continue to work.
        mw: {
          primary:         '#0ED3CF',   // remapped to teal
          'primary-light': '#CCFBF1',
          'primary-mid':   '#0ED3CF',
          'primary-hover': '#0BB8B5',
          dark:            '#1A1A1A',   // remapped to near-black
          'dark-hover':    '#111111',
          grey:            '#6B7280',
          'grey-light':    '#E5E5E3',
          'grey-lighter':  '#F5F3F0',
          // Dark-mode surface tokens (kept as stubs so dark: classes compile cleanly)
          'surface-dark':      '#FAF9F7',
          'card-border-dark':  '#E5E5E3',
          'muted-dark':        '#F5F3F0',
          'muted-border-dark': '#E5E5E3',
          'muted-text-dark':   '#6B7280',
          'accent-text-dark':  '#0ED3CF',
          'scrollbar-dark':    '#D1D5DB',
        },
      },
      fontSize: {
        xs:    ['11px', { lineHeight: '1.2'  }],
        sm:    ['13px', { lineHeight: '1.5'  }],
        base:  ['15px', { lineHeight: '1.6'  }],
        md:    ['15px', { lineHeight: '1.6'  }],
        lg:    ['16px', { lineHeight: '1.5'  }],
        xl:    ['18px', { lineHeight: '1.35' }],
        '2xl': ['24px', { lineHeight: '1.3'  }],
        '3xl': ['32px', { lineHeight: '1.2'  }],
        '4xl': ['40px', { lineHeight: '1.1'  }],
        '5xl': ['48px', { lineHeight: '1.1'  }],
      },
      borderRadius: {
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '20px',
        card: '16px',
        pill: '9999px',
      },
      boxShadow: {
        sm:  '0 1px 3px rgba(0, 0, 0, 0.04)',
        md:  '0 4px 12px rgba(0, 0, 0, 0.06)',
        lg:  '0 8px 24px rgba(0, 0, 0, 0.08)',
        xl:  '0 16px 48px rgba(0, 0, 0, 0.10)',
      },
      transitionDuration: {
        micro:    '0ms',
        fast:     '150ms',
        standard: '250ms',
        slow:     '400ms',
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
        'draw-in': {
          from: { strokeDashoffset: '1000' },
          to:   { strokeDashoffset: '0'    },
        },
      },
      animation: {
        shimmer:          'shimmer 1.5s infinite linear',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-up':    'slide-in-up 0.15s ease-out',
        'fade-in':        'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
