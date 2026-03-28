/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sol: '#F5A623',
        cerrado: '#4A7C59',
        borda: '#E8E2D8',
        muted: '#6B6B5E',
        fundo: '#FBF6EE',
        'laranja-claro': '#FFF4E0',
        'verde-claro': '#E8F5E9',
      },
      fontFamily: {
        head: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
