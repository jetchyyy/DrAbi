/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f4f7fb',
          100: '#e6edf5',
          200: '#cddceb',
          300: '#a3c0d8',
          400: '#759ec1',
          500: '#5582a8',
          600: '#416688',
          700: '#34526f',
          800: '#2d455d',
          900: '#172937', 
          950: '#0e1821'
        },
        blue: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'none': '0',
        'sm': '0',
        DEFAULT: '0',
        'md': '0',
        'lg': '0',
        'xl': '0',
        '2xl': '0',
        '3xl': '0',
        'full': '9999px',
      }
    },
  },
  plugins: [],
};

