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
          primary: '#0089DD',
          'primary-light': '#E8F4FB',
          'primary-mid': '#4AADEA',
          dark: '#003E65',
          'dark-hover': '#002D4A',
          grey: '#6C7A89',
          'grey-light': '#E2ECF5',
          'grey-lighter': '#F5F8FC',
        },
        util: {
          bench: '#F5F8FC',
          healthy: '#0089DD',
          near: '#D97706',
          over: '#DC2626',
        },
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.2' }],
        sm: ['12px', { lineHeight: '1.35' }],
        base: ['14px', { lineHeight: '1.5' }],
        md: ['15px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.35' }],
        xl: ['18px', { lineHeight: '1.35' }],
        '2xl': ['22px', { lineHeight: '1.2' }],
        '3xl': ['28px', { lineHeight: '1.2' }],
        '4xl': ['36px', { lineHeight: '1.0' }],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
