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
        sans:    ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // ── Mileway brand tokens ──────────────────────────────────────────────
        mileway: {
          'light-blue':    '#0089DD',
          'light-blue-50': '#80C4EE',
          'light-blue-30': '#B3D9F5',
          'light-blue-20': '#CCE4F9',
          'light-blue-10': '#E6F2FC',
          'dark-blue':     '#003565',
          'dark-blue-50':  '#809AB2',
          'dark-blue-30':  '#B3C2CF',
          'dark-blue-20':  '#CCD3DC',
          'dark-blue-10':  '#E6EAF0',
          'cool-grey':     '#6C7A89',
          'cool-grey-50':  '#B5BDC4',
          'cool-grey-30':  '#CFCFD5',
          'cool-grey-20':  '#DEDFE3',
          'cool-grey-10':  '#EEEEF1',
          'off-white':     '#F5F8FC',
        },
        // ── BIZ track — updated to Mileway brand (cool grey family) ──────────
        biz: {
          DEFAULT: '#6C7A89',
          light:   '#EEEEF1',
          mid:     '#DEDFE3',
          border:  '#CFCFD5',
          hover:   '#B5BDC4',
        },
        // ── Semantic ──────────────────────────────────────────────────────────
        util: {
          bench:   '#F5F8FC',
          healthy: '#16A34A',
          near:    '#D97706',
          over:    '#DC2626',
        },
        // ── Legacy mw-* aliases — mapped to new Mileway brand values ─────────
        mw: {
          primary:         '#0089DD',
          'primary-light': '#E6F2FC',
          'primary-mid':   '#0089DD',
          'primary-hover': '#0077C2',
          dark:            '#003565',
          'dark-hover':    '#002550',
          grey:            '#6C7A89',
          'grey-light':    '#CFCFD5',
          'grey-lighter':  '#EEEEF1',
        },
        // ── Legacy sana-* aliases — kept so existing classes still compile ────
        sana: {
          'bg':           '#F5F8FC',
          'bg-secondary': '#EEEEF1',
          'bg-card':      '#FFFFFF',
          'bg-highlight': '#E6F2FC',
          'bg-alt':       '#E6EAF0',
          'text':         '#003565',
          'text-muted':   '#6C7A89',
          'text-faint':   '#B5BDC4',
          'teal':         '#0089DD',
          'teal-light':   '#E6F2FC',
          'orange':       '#D97706',
          'orange-light': '#FEF3C7',
          'coral':        '#DC2626',
          'magenta':      '#6C7A89',
          'border':       '#CFCFD5',
          'border-light': '#DEDFE3',
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
