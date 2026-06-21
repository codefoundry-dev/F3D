import { AuthBackground } from './AuthBackground';
import { Spinner } from './Spinner';

/**
 * AuthPageLoader — full-screen loading state shown while an auth route's lazy
 * chunk loads (Figma "Loader" frame 6277:175323), reworked to sit on the shared
 * construction-site background with a white spinner so transitions between the
 * auth screens stay on one consistent backdrop.
 *
 * Used as the Suspense fallback for the login / verify-otp / forgot-password /
 * activate / reset-password routes; the rest of the app keeps the plain
 * {@link PageLoader}.
 */
export function AuthPageLoader() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <AuthBackground />
      <Spinner className="relative h-16 w-16 text-white" />
    </div>
  );
}
