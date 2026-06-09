import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#000000',
          900: '#050505',
          850: '#0d0d0d',
          800: '#141414',
          750: '#1c1c1c',
          700: '#252525',
          650: '#2e2e2e',
          600: '#383838',
          500: '#505050',
          400: '#707070',
          300: '#999999',
        },
        gold: {
          200: '#f0f0f0',
          300: '#e0e0e0',
          400: '#cccccc',
          500: '#ffffff',
          600: '#e8e8e8',
          700: '#d0d0d0',
        },
      },
    },
  },
  plugins: [],
};

export default config;
