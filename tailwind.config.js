/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '.dark-theme'],
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          '50': '#f6f5fa',
          '100': '#EDE8F5',
          '200': '#D6D6EB',
          '300': '#ADBBD4',
          '400': '#232B4A',
          '500': '#3D52A0',
          '600': '#7B8AC0',
          '700': '#7091E6',
          '800': '#5670B8',
          '900': '#8697C4',
          '950': '#9AA9C8',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
} 