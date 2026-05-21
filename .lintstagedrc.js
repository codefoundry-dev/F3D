module.exports = {
  '**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,yaml,yml,css}': [
    'prettier --write --cache --cache-strategy metadata',
  ],
};
