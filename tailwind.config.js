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
          '50': '#f6f5fa',    // very light tint
          '100': '#EDE8F5',    // lightest from palette
          '200': '#D6D6EB',    // between 100 and 300
          '300': '#ADBBD4',    // from palette
          '400': '#232B4A',    // between 300 and 500
          '500': '#3D52A0',    // from palette
          '600': '#7B8AC0',    // between 500 and 700
          '700': '#7091E6',    // from palette
          '800': '#5670B8',    // between 700 and 900
          '900': '#8697C4',    // from palette
          '950': '#9AA9C8',    // very dark blue
          '1000': '#070a13ff',   // near black
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
} 