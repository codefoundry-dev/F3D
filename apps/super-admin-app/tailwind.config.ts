import type { Config } from 'tailwindcss';
import { foreThreadPreset } from '@forethread/config/tailwind';

const config: Config = {
  presets: [foreThreadPreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui-components/src/**/*.{ts,tsx}',
    '../../packages/profile-shared/src/**/*.{ts,tsx}',
  ],
  plugins: [],
};

export default config;
