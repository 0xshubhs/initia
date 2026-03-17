import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-hover': '#1a1a1a',
        border: '#222222',
        'border-bright': '#333333',
        amber: {
          DEFAULT: '#ffb000',
          light: '#ffd000',
          dim: '#996a00',
          subtle: 'rgba(255, 176, 0, 0.08)',
        },
        green: {
          DEFAULT: '#00ff41',
          dim: '#00aa2a',
        },
        red: {
          DEFAULT: '#ff0040',
          dim: '#aa002a',
        },
        text: {
          DEFAULT: '#e0e0e0',
          secondary: '#888888',
          dim: '#555555',
        },
      },
      fontFamily: {
        mono: [
          "'JetBrains Mono'",
          "'SF Mono'",
          "'Cascadia Code'",
          "'Fira Code'",
          'ui-monospace',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}

export default config
