/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBF9F5', ink: '#17140F', accent: '#A11B1B',
        rule: '#E5DFD3', muted: '#8A8175', drawer: '#F4F0E7',
      },
      fontFamily: {
        serif: ['Georgia', '"Iowan Old Style"', '"Times New Roman"', 'serif'],
        sans: ['system-ui', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
