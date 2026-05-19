/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@forethread/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
