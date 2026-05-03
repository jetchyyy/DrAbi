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
        /* Secondary / info accent — CPR Med blue (replaces mistaken orange-as-blue mapping) */
        blue: {
          50: '#eff9ff',
          100: '#dff3fd',
          200: '#b8e8fb',
          300: '#7dd4f7',
          400: '#47c0f4',
          500: '#34b2f9',
          600: '#1d9ad9',
          700: '#177bb3',
          800: '#156293',
          900: '#15527a',
          950: '#0f3d5c'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      borderRadius: {
        'none': '0',
        'sm': '0',
        DEFAULT: '0',
        'md': '0',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px',
      }
    },
  },
  plugins: [],
};

