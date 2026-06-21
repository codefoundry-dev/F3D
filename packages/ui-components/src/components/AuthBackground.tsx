import authBackground from '../assets/auth-background.jpg';

/**
 * AuthBackground — the full-bleed construction-site photo (Figma node 4818:20995)
 * with a subtle backdrop blur + light-to-dark gradient overlay for legibility.
 *
 * Shared by every auth surface (the AuthLayout card screens and the auth-route
 * loader) so login, verification, reset, activation and the loading state all sit
 * on one consistent backdrop. Renders three absolutely-positioned layers, so the
 * parent must be `relative` (and typically `overflow-hidden`):
 *   1. a solid slate fallback tone — painted instantly so route transitions never
 *      flash white in the frame before the photo decodes;
 *   2. the photo itself (object-cover);
 *   3. the blur + gradient overlay.
 */
export function AuthBackground() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-[#3f4a57]" />
      <img
        src={authBackground}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full select-none object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-white/30 to-black/30 backdrop-blur-[2px]"
      />
    </>
  );
}
