// prettier.config.js or .prettierrc.js
// Single Prettier source of truth for CLI and VS Code
// VS Code is configured to use this file via .vscode/settings.json (prettier.configPath)
module.exports = {
  // Style
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  arrowParens: 'always',
  jsxSingleQuote: false,
  bracketSpacing: false,
  tabWidth: 2,
  useTabs: false,
  // Markdown/docs
  proseWrap: 'never',
};
