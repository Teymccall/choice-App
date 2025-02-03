/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f7f7f7',
          100: '#e3e3e3',
          200: '#c8c8c8',
          300: '#a4a4a4',
          400: '#818181',
          500: '#666666',
          600: '#515151',
          700: '#434343',
          800: '#383838',
          900: '#000000',
        },
        active: '#000000',
        accent: {
          light: '#e3e3e3',
          DEFAULT: '#000000',
          dark: '#1a1a1a',
        },
        dark: {
          bg: '#000000',
          surface: '#000000',
          border: '#333333',
          hover: '#1a1a1a',
          active: '#333333',
          text: {
            primary: '#ffffff',
            secondary: '#a0a0a0',
          },
        },
      },
      backgroundColor: theme => ({
        ...theme('colors'),
        'dark-mode': {
          primary: '#000000',
          secondary: '#000000',
          surface: '#000000',
        },
      }),
      textColor: theme => ({
        ...theme('colors'),
        'dark-mode': {
          primary: '#ffffff',
          secondary: '#a0a0a0',
        },
      }),
      borderColor: theme => ({
        ...theme('colors'),
        'dark-mode': {
          primary: '#333333',
          secondary: '#333333',
        },
      }),
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-width': 'pulse-width 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: 0 },
          '50%': { transform: 'scale(1.05)', opacity: 0.8 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'pulse-width': {
          '0%, 100%': { transform: 'scaleX(0)', opacity: '0' },
          '50%': { transform: 'scaleX(1)', opacity: '1' },
        }
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

