import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Carbón cálido → reemplaza slate
        slate: {
          50:  '#FAF8F6',
          100: '#F5F1EE',
          200: '#EDE8E4',
          300: '#DDD6D0',
          400: '#C8BFB8',
          500: '#8A817C',
          600: '#52453F',
          700: '#3A322D',
          800: '#2C2622',
          900: '#211D1A',
          950: '#161412',
        },
        // Ámbar cálido → reemplaza cyan (color primario de la marca)
        cyan: {
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0284C7',
          600: '#0369A1',
          950: '#082F49',
        },
        // Terracota → reemplaza indigo (color de acciones secundarias)
        indigo: {
          300: '#FDBA74',
          400: '#F97316',
          500: '#EA580C',
          600: '#C2410C',
          700: '#9A3412',
          800: '#7C2D12',
          900: '#431407',
          950: '#270A01',
        },
      },
    },
  },
  plugins: [],
};

export default config;
