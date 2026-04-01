/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        flip: {
          400: 'rgb(var(--flip-400) / <alpha-value>)',
          500: 'rgb(var(--flip-500) / <alpha-value>)',
        },
        accent: {
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
        },
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
          4: 'rgb(var(--surface-4) / <alpha-value>)',
          5: 'rgb(var(--surface-5) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'pill': '9999px',
        'mac': '14px',
        'mac-lg': '18px',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '40px',
      },
      boxShadow: {
        'mac': '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.04)',
        'mac-lg': '0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.04)',
        'mac-xl': '0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        'slide-right': 'slideRight 0.25s cubic-bezier(0.16,1,0.3,1)',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'flip-in': 'flipIn 0.4s cubic-bezier(0.16,1,0.3,1)',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        flipIn: {
          '0%': { opacity: '0', transform: 'rotateY(-90deg) scale(0.9)' },
          '100%': { opacity: '1', transform: 'rotateY(0deg) scale(1)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 12px rgba(255,98,52,0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(255,98,52,0.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
