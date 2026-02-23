/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ww-dark': '#0d1117',
        'ww-surface': '#161b22',
        'ww-border': '#30363d',
        'ww-orange': '#E65100',
        'ww-red': '#D32F2F',
        'ww-yellow': '#F9A825',
        'ww-green': '#2E7D32',
        'ww-advisory': '#F9A825',
        'ww-action': '#E65100',
        'ww-danger': '#D32F2F',
      },
      animation: {
        'pulse-danger': 'pulseDanger 1s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseDanger: {
          '0%, 100%': { borderColor: '#D32F2F', boxShadow: '0 0 20px rgba(211,47,47,0.5)' },
          '50%': { borderColor: '#FF5252', boxShadow: '0 0 40px rgba(255,82,82,0.8)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
