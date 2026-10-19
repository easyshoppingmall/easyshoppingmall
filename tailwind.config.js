/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0092EE',
          dark: '#0077C2',
          light: '#E5F4FD',
          start: '#0092EE',
          end: '#0067B3',
        },
        ink: {
          DEFAULT: '#12263A',
        },
        muted: {
          DEFAULT: '#64748B',
        },
        line: {
          DEFAULT: '#E3EAF1',
        },
        bg: {
          DEFAULT: '#F7FAFC',
          app: '#EEF4FA',
        },
        card: {
          DEFAULT: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#E5484D',
          light: '#FDECEF',
        },
        tint: {
          blue: '#E5F4FD',
          orange: '#FFF1E0',
          green: '#EAF7EE',
          purple: '#F3EBFB',
          pink: '#FDECEF',
          yellow: '#FEF9C3',
        },
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'btn': '11px',
        'chip': '20px',
        'lg': '14px',
        'xl': '18px',
        'card': '14px',
        'ph': '34px',
      },
    },
  },
  plugins: [],
};
