import type { Config } from 'tailwindcss';

/**
 * Tailwind config built EXCLUSIVELY from the Coinbase design tokens
 * documented in DESIGN.md (source: `npx getdesign@latest add coinbase`).
 *
 * NEVER add a color, font, radius, spacing, or shadow outside this list.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    // Coinbase palette — single source of truth, no other colors allowed.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      primary: {
        DEFAULT: '#0052ff',
        active: '#003ecc',
        disabled: '#a8b8cc',
      },
      ink: '#0a0b0d',
      body: {
        DEFAULT: '#5b616e',
        strong: '#0a0b0d',
      },
      muted: {
        DEFAULT: '#7c828a',
        soft: '#a8acb3',
      },
      hairline: {
        DEFAULT: '#dee1e6',
        soft: '#eef0f3',
      },
      canvas: '#ffffff',
      surface: {
        soft: '#f7f7f7',
        card: '#ffffff',
        strong: '#eef0f3',
        dark: '#0a0b0d',
        'dark-elevated': '#16181c',
      },
      on: {
        primary: '#ffffff',
        dark: '#ffffff',
        'dark-soft': '#a8acb3',
      },
      semantic: {
        up: '#05b169',
        down: '#cf202f',
      },
      accent: {
        yellow: '#f4b000',
      },
    },
    // Coinbase font families. Substitutes per DESIGN.md "Known Gaps".
    fontFamily: {
      display: ["'Coinbase Display'", '-apple-system', 'system-ui', "'Segoe UI'", 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      sans: ["'Coinbase Sans'", '-apple-system', 'system-ui', "'Segoe UI'", 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      mono: ["'Coinbase Mono'", "'Coinbase Sans'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    // Typography scale mirrors typography.* tokens in DESIGN.md.
    fontSize: {
      'display-mega': ['80px', { lineHeight: '1.0', letterSpacing: '-2px', fontWeight: '400' }],
      'display-xl': ['64px', { lineHeight: '1.0', letterSpacing: '-1.6px', fontWeight: '400' }],
      'display-lg': ['52px', { lineHeight: '1.0', letterSpacing: '-1.3px', fontWeight: '400' }],
      'display-md': ['44px', { lineHeight: '1.09', letterSpacing: '-1px', fontWeight: '400' }],
      'display-sm': ['36px', { lineHeight: '1.11', letterSpacing: '-0.5px', fontWeight: '400' }],
      'title-lg': ['32px', { lineHeight: '1.13', letterSpacing: '-0.4px', fontWeight: '400' }],
      'title-md': ['18px', { lineHeight: '1.33', letterSpacing: '0', fontWeight: '600' }],
      'title-sm': ['16px', { lineHeight: '1.25', letterSpacing: '0', fontWeight: '600' }],
      'body-md': ['16px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
      'body-strong': ['16px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '700' }],
      'body-sm': ['14px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
      caption: ['13px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
      'caption-strong': ['12px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '600' }],
    },
    // Radius tokens from DESIGN.md rounded.*.
    borderRadius: {
      none: '0px',
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      pill: '100px',
      full: '9999px',
    },
    // Spacing tokens from DESIGN.md spacing.*.
    spacing: {
      'xxs': '4px',
      'xs': '8px',
      'sm': '12px',
      'base': '16px',
      'md': '20px',
      'lg': '24px',
      'xl': '32px',
      'xxl': '48px',
      'section': '96px',
      // Standard Tailwind spacing preserved so utilities keep working.
      '0': '0px',
      '1': '4px',
      '2': '8px',
      '3': '12px',
      '4': '16px',
      '5': '20px',
      '6': '24px',
      '8': '32px',
      '10': '40px',
      '12': '48px',
      '16': '64px',
      '20': '80px',
      '24': '96px',
    },
    // 3 mandatory breakpoints: mobile / tablet / desktop.
    screens: {
      // Mobile is the default (< 768px) — no prefix needed.
      md: '768px', // tablet
      lg: '1024px', // desktop
    },
    // Coinbase system has one shadow tier.
    boxShadow: {
      coinbase: '0 1px 2px rgba(10, 11, 13, 0.06), 0 1px 1px rgba(10, 11, 13, 0.04)',
    },
    extend: {
      // Semantic background/text aliases mapping to the Coinbase palette.
      backgroundColor: {
        background: '#ffffff',
        foreground: '#0a0b0d',
      },
      textColor: {
        background: '#ffffff',
        foreground: '#0a0b0d',
      },
    },
  },
  plugins: [],
};

export default config;