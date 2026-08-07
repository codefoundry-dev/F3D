import type { SVGProps } from 'react';

/**
 * Stand-in for `*.svg?react` imports under Vitest.
 *
 * The app builds these through vite-plugin-svgr, which the package's own test
 * run does not load. Aliasing them to an inert `<svg>` keeps icon imports from
 * failing module resolution without pulling the plugin into every package.
 */
export default function SvgStub(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} />;
}
