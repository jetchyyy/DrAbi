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
        /* Primary brand green — MEDIKA #4cb154 */
        green: {
          50: '#f0faf1',
          100: '#dbf4de',
          200: '#b8e8bc',
          300: '#87d48e',
          400: '#5fc268',
          500: '#4cb154',
          600: '#358d3d',
          700: '#2b7032',
          800: '#24592a',
          900: '#1e4a23',
          950: '#0e2912'
        },
        emerald: {
          50: '#f0faf1',
          100: '#dbf4de',
          200: '#b8e8bc',
          300: '#87d48e',
          400: '#5fc268',
          500: '#4cb154',
          600: '#358d3d',
          700: '#2b7032',
          800: '#24592a',
          900: '#1e4a23',
          950: '#0e2912'
        },
        /* Secondary accent — MEDIKA red */
        red: {
          50: '#fff1f2',
          100: '#ffe0e1',
          200: '#ffc5c6',
          300: '#ff9698',
          400: '#ff5c5f',
          500: '#ef282c',
          600: '#d41419',
          700: '#b20f13',
          800: '#940e12',
          900: '#7a1114',
          950: '#420607'
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

