/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sol: '#F5A623',
        'sol-dark': '#D98C0F',
        cerrado: '#4A7C59',
        borda: '#E8E2D8',
        muted: '#6B6B5E',
        fundo: '#FBF6EE',
        areia: '#F0E9DC',
        'laranja-claro': '#FFF4E0',
        'verde-claro': '#E8F5E9',
      },
      fontFamily: {
        head: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 12px rgba(26,26,24,0.08)',
        'card-hover': '0 4px 20px rgba(26,26,24,0.14)',
        'input-focus': '0 0 0 3px rgba(245,166,35,0.20)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
