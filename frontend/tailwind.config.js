/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ["'Inter'", "system-ui", "sans-serif"],
        body:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },

      colors: {
        // Premium modern color palette
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // primary button
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        obsidian: {
          50: '#f4f6fa',
          100: '#e9ecf5',
          200: '#cbd4e7',
          300: '#9cb0d5',
          400: '#6585bd',
          500: '#4161a0',
          600: '#314a80',
          700: '#263962',
          800: '#111827', // Card dark bg
          850: '#0B0F19', // Main dark bg
          900: '#030712', // Pure deep obsidian
        },
        surface: {
          DEFAULT: '#ffffff',
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
        },
      },

      animation: {
        'fade-in':        'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up':       'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float':          'float 6s ease-in-out infinite',
        'pulse-glow':     'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.8', transform: 'scale(1.05)' },
        }
      },

      boxShadow: {
        // Soft, highly diffused shadows for premium glass look
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'dark-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'dark-glass-hover': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'soft-hover': '0 10px 40px -4px rgba(0, 0, 0, 0.08)',
        'focus-ring': '0 0 0 4px rgba(59, 130, 246, 0.15)',
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.15)',
      },
    },
  },
  plugins: [],
};
