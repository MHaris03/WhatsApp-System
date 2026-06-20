/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        wa: {
          green: '#25d366',
          dark: '#075e54',
          teal: '#128c7e',
          panel: '#f0f2f5',
          bubble: '#d9fdd3',
          chatbg: '#efeae2',
        },
      },
      keyframes: {
        pop: {
          '0%': { opacity: '0', transform: 'scale(.96) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        pop: 'pop .12s ease-out',
      },
    },
  },
  plugins: [],
};
