/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: false,
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Mileway brand tokens ──────────────────────────────────────────────
        mileway: {
          blue:        '#0089DD',
          'blue-20':   '#CCE4F9',
          'blue-10':   '#E6F2FC',
          grey:        '#94A3B8',
          'grey-10':   '#F0F2F5',
          text:        '#1E293B',
          border:      '#DEDFE3',
          divider:     '#F0F2F5',
          bg:          '#F5F8FC',
        },
        // ── BIZ track ────────────────────────────────────────────────────────
        biz: {
          DEFAULT: '#94A3B8',
          light:   '#F0F2F5',
          mid:     '#DEDFE3',
          border:  '#DEDFE3',
          hover:   '#94A3B8',
        },
        // ── Semantic status colours ───────────────────────────────────────────
        util: {
          bench:   '#F5F8FC',
          healthy: '#16A34A',
          near:    '#D97706',
          over:    '#DC2626',
        },
        // ── Legacy mw-* aliases ───────────────────────────────────────────────
        mw: {
          primary:         '#0089DD',
          'primary-light': '#E6F2FC',
          'primary-mid':   '#0089DD',
          'primary-hover': '#0077C2',
          dark:            '#1E293B',
          'dark-hover':    '#0F172A',
          grey:            '#94A3B8',
          'grey-light':    '#DEDFE3',
          'grey-lighter':  '#F5F8FC',
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
        sm:   '6px',
        md:   '8px',
        lg:   '10px',
        xl:   '12px',
        card: '10px',
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
