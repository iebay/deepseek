/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'gh-bg': '#0d1117',
        'gh-surface': '#161b22',
        'gh-border': '#30363d',
        'gh-text': '#e6edf3',
        'gh-muted': '#8b949e',
        'gh-subtle': '#6e7681',
        'gh-blue': '#388bfd',
        'gh-green': '#238636',
      },
    },
  },
  plugins: [],
};
