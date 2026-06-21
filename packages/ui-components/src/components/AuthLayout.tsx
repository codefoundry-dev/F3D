import type { ReactNode } from 'react';

import authCardBg from '../assets/auth-card-bg.png';
import { cn } from '../utils/cn';

import { AuthBackground } from './AuthBackground';

export interface AuthLayoutProps {
  /**
   * Brand wordmark (login screen). When provided, the header renders the logo
   * and the title uses the larger Headline/M (40px) size.
   */
  logo?: ReactNode;
  /**
   * Raw header icon (~24px). Rendered inside the DS white-gradient badge chip.
   * Used by every non-login auth screen; title uses Headline/S (32px).
   */
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * AuthLayout — shared shell for every auth screen (Figma "US 1.03 – User login"
 * and the "Modal/Log in" / "Modal/Password" cards — file CFA6k0XCvImOmWXbBgdWYZ).
 *
 * A full-bleed construction-site photo background (Figma node 4818:20995) — with a
 * 4px backdrop blur + light-to-dark gradient overlay for legibility — sits behind a
 * centred 480px white card (Corner/3xl 32px + Shadow/shadow-xs) carrying the orange
 * perspective-grid + glow header decoration. The header is either the brand logo
 * (login) or a white-gradient icon badge (everything else), followed by a centred
 * title + description. Content (form / slot) fills the body below.
 */
export function AuthLayout({ logo, icon, title, description, children }: AuthLayoutProps) {
  const hasText = Boolean(title) || Boolean(description);
  const hasHeader = Boolean(logo) || Boolean(icon) || hasText;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Full-bleed construction-site photo background (Figma node 4818:20995). */}
      <AuthBackground />

      <div className="relative flex w-full max-w-[480px] flex-col items-center gap-10 overflow-hidden rounded-[32px] bg-card p-10 shadow-[0px_1px_6px_0px_rgba(10,13,18,0.06),0px_1px_2px_0px_rgba(10,13,18,0.02)]">
        {/* Orange perspective-grid + glow decoration (Figma node 4263:98671). */}
        <img
          src={authCardBg}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[180px] w-full select-none object-cover"
        />

        {hasHeader && (
          <header className="relative flex w-full flex-col items-center gap-4">
            {logo ??
              (icon ? (
                <div className="flex size-12 items-center justify-center rounded-[14px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white shadow-[0px_1px_3px_0px_rgba(10,13,18,0.06),0px_1px_1px_0px_rgba(10,13,18,0.02)]">
                  {icon}
                </div>
              ) : null)}

            {hasText && (
              <div className="flex w-full flex-col gap-2 text-center">
                {title && (
                  <h1
                    className={cn(
                      'font-medium leading-[1.4] tracking-[0.3px] text-gray-900',
                      logo ? 'text-[40px]' : 'text-[32px]',
                    )}
                  >
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-[14px] font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
                    {description}
                  </p>
                )}
              </div>
            )}
          </header>
        )}

        <div className="relative w-full">{children}</div>
      </div>
    </div>
  );
}
