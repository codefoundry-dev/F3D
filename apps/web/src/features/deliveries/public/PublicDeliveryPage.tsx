import {
  getDeliveryPortalPo,
  identifyDeliveryPortal,
  verifyDeliveryPortal,
  submitDeliveryPortal,
  uploadDeliveryPortalLinePhoto,
  uploadDeliveryPortalAttachment,
  finalizeDeliveryPortal,
  isApiError,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import type { DeliveryPortalPoResponse } from '@forethread/shared-types/client';
import { Alert, Button, Input, Spinner, Textarea, cn, notificationService } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import EyeClosedIcon from '@forethread/ui-components/assets/icons/eye-closed.svg?react';
import EyeOpenIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { PortalLineItem } from './PortalLineItem';
import {
  isPortalLineValid,
  portalLineToInput,
  portalPoLineToDraft,
  resolveOutcome,
  summarisePortalLines,
  type PortalLineDraft,
} from './portalLines';

/** Steps of the public mobile delivery flow (screenshots 10–14). */
type Step = 'identify' | 'code' | 'form' | 'submitted';

const OTP_LENGTH = 6;
/** Access code lifetime mirrored client-side for the countdown (15 min). */
const CODE_TTL_SECONDS = 15 * 60;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Public, unauthenticated mobile delivery form reached by scanning the PO's
 * delivery QR code (route `/delivery/:token`, no app shell). A step machine walks
 * the delivery person through: (1) identify → emails a 6-digit code, (2) verify →
 * exchanges the code for a session token, (3) the delivery report itself, then
 * (4) a submitted summary. Mirrors the tokenised GuestPurchaseOrderPage for token
 * resolution + error handling, and reuses the auth OTP entry look.
 */
export default function PublicDeliveryPage() {
  const { t } = useTranslation('deliveries');
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<Step>('identify');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [submittedLines, setSubmittedLines] = useState<PortalLineDraft[]>([]);
  const [submittedPoNumber, setSubmittedPoNumber] = useState<string | null>(null);

  // The PO header + lines only load once the person has started (kept enabled so
  // an expired/invalid token surfaces the same error state as the guest PO page).
  const {
    data: po,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['delivery-portal-po', token],
    queryFn: () => getDeliveryPortalPo(token ?? ''),
    enabled: !!token,
    retry: false,
  });

  const resetToIdentify = useCallback(() => {
    setSessionToken(null);
    setStep('identify');
  }, []);

  if (!token) {
    return <PortalError title={t('portal.invalidToken')} hint={t('portal.invalidTokenHint')} />;
  }

  // A 403 means the token is expired / revoked — distinct from a malformed link.
  if (isError) {
    const expired = isApiError(error, 403);
    return (
      <PortalError
        title={expired ? t('portal.expiredToken') : t('portal.invalidToken')}
        hint={expired ? t('portal.expiredTokenHint') : t('portal.invalidTokenHint')}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        {step === 'identify' && (
          <IdentifyStep
            token={token}
            name={name}
            email={email}
            onName={setName}
            onEmail={setEmail}
            onSent={() => setStep('code')}
          />
        )}

        {step === 'code' && (
          <CodeStep
            token={token}
            email={email}
            onVerified={(session) => {
              setSessionToken(session);
              setStep('form');
            }}
            onChangeEmail={resetToIdentify}
          />
        )}

        {step === 'form' &&
          (isLoading || !po ? (
            <div className="flex items-center justify-center py-24">
              <Spinner size="lg" />
            </div>
          ) : (
            <ReportFormStep
              po={po}
              token={token}
              sessionToken={sessionToken}
              name={name}
              email={email}
              onSubmitted={(lines) => {
                setSubmittedLines(lines);
                setSubmittedPoNumber(po.poNumber);
                setStep('submitted');
              }}
            />
          ))}

        {step === 'submitted' && (
          <SubmittedStep
            poNumber={submittedPoNumber}
            lines={submittedLines}
            onLogOut={() => {
              setName('');
              setEmail('');
              setSubmittedLines([]);
              resetToIdentify();
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Token error ──────────────────────────────────────────────────────────── */

function PortalError({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <Alert variant="destructive">{title}</Alert>
        <p className="mt-4 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/* ─── Step 1: Identify yourself (screenshot 10) ──────────────────────────────── */

function IdentifyStep({
  token,
  name,
  email,
  onName,
  onEmail,
  onSent,
}: {
  token: string;
  name: string;
  email: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onSent: () => void;
}) {
  const { t } = useTranslation('deliveries');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const submit = async () => {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = t('portal.identify.nameRequired');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = t('portal.identify.emailRequired');
    setErrors(next);
    if (next.name || next.email) return;

    setSubmitting(true);
    try {
      await identifyDeliveryPortal(token, { name: name.trim(), email: email.trim() });
      onSent();
    } catch {
      // Anti-enumeration: the call should always succeed; only a transport error
      // lands here.
      notificationService.error(t('portal.identify.sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalCard>
      <h1 className="text-2xl font-bold text-foreground">{t('portal.identify.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('portal.identify.subtitle')}</p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="portal-name" className="text-sm font-medium text-foreground">
            {t('portal.identify.fullName')} <span className="text-destructive">*</span>
          </label>
          <Input
            id="portal-name"
            className={cn(PORTAL_INPUT_CLASS, errors.name && 'border-destructive')}
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder={t('portal.identify.fullNamePlaceholder')}
            aria-invalid={!!errors.name}
            data-testid="portal-identify-name"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="portal-email" className="text-sm font-medium text-foreground">
            {t('portal.identify.email')} <span className="text-destructive">*</span>
          </label>
          <Input
            id="portal-email"
            type="email"
            inputMode="email"
            className={cn(PORTAL_INPUT_CLASS, errors.email && 'border-destructive')}
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder={t('portal.identify.emailPlaceholder')}
            aria-invalid={!!errors.email}
            data-testid="portal-identify-email"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-2 w-full"
          isLoading={submitting}
          data-testid="portal-identify-submit"
        >
          {t('portal.identify.submit')}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t('portal.identify.helper')}</p>
    </PortalCard>
  );
}

/* ─── Step 2: Enter access code (screenshot 11) ──────────────────────────────── */

function CodeStep({
  token,
  email,
  onVerified,
  onChangeEmail,
}: {
  token: string;
  email: string;
  onVerified: (sessionToken: string) => void;
  onChangeEmail: () => void;
}) {
  const { t } = useTranslation('deliveries');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const code = digits.join('');
  const isComplete = code.length === OTP_LENGTH;
  const isExpired = secondsLeft === 0;

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== OTP_LENGTH || submitting) return;
      setSubmitting(true);
      setErrorKey(null);
      try {
        const { sessionToken } = await verifyDeliveryPortal(token, { email, code: value });
        onVerified(sessionToken);
      } catch (err) {
        // 429 (or a locked 403) → lockout copy; anything else → invalid code.
        setErrorKey(
          isApiError(err, 429) ? 'portal.code.locked' : 'portal.code.invalid',
        );
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      } finally {
        setSubmitting(false);
      }
    },
    [token, email, onVerified, submitting],
  );

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'Enter') void verify(digits.join(''));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      void verify(pasted);
    }
  };

  return (
    <PortalCard>
      <h1 className="text-2xl font-bold text-foreground">{t('portal.code.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('portal.code.subtitle', { email })}</p>

      <div className="mt-6 flex justify-center gap-2" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={submitting || isExpired}
            aria-label={t('portal.code.digitLabel', { index: i + 1 })}
            data-testid={`portal-code-digit-${i}`}
            className={cn(
              'h-12 w-12 rounded-xl border border-black/15 bg-card text-center text-lg font-medium text-foreground',
              'focus:border-foreground/50 focus:outline-none disabled:opacity-50',
            )}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <ClockIcon className="h-4 w-4" />
        {isExpired ? t('portal.code.expired') : t('portal.code.expiresIn', { time: formatCountdown(secondsLeft) })}
      </div>

      {errorKey && (
        <div className="mt-4">
          <Alert variant="destructive">{t(errorKey as never)}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={submitting}
          disabled={!isComplete || isExpired}
          onClick={() => void verify(code)}
          data-testid="portal-code-verify"
        >
          {t('portal.code.verify')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onChangeEmail}
          data-testid="portal-code-change-email"
        >
          {t('portal.code.changeEmail')}
        </Button>
      </div>
    </PortalCard>
  );
}

/* ─── Step 3: Delivery report form (screenshots 12/13) ───────────────────────── */

function ReportFormStep({
  po,
  token,
  sessionToken,
  name,
  email,
  onSubmitted,
}: {
  po: DeliveryPortalPoResponse;
  token: string;
  sessionToken: string | null;
  name: string;
  email: string;
  onSubmitted: (lines: PortalLineDraft[]) => void;
}) {
  const { t } = useTranslation('deliveries');

  const [lines, setLines] = useState<PortalLineDraft[]>(() => po.lines.map(portalPoLineToDraft));
  const [overallNotes, setOverallNotes] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [filter, setFilter] = useState<LineFilter>('all');
  const [showEmail, setShowEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const attachmentRef = useRef<HTMLInputElement>(null);

  const updateLine = (id: string, patch: Partial<PortalLineDraft>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const visibleLines = useMemo(() => lines.filter((l) => matchesFilter(l, filter)), [lines, filter]);
  const allValid = useMemo(() => lines.length > 0 && lines.every(isPortalLineValid), [lines]);

  const handleSubmit = async () => {
    if (!sessionToken || !allValid || submitting) return;
    setSubmitting(true);
    try {
      await submitDeliveryPortal(sessionToken, {
        overallNotes: overallNotes.trim() || undefined,
        lines: lines.map(portalLineToInput),
      });

      // Best-effort evidence uploads (a failure shouldn't strand the submission).
      const uploads: Promise<unknown>[] = [];
      for (const line of lines) {
        for (const file of line.photos) {
          uploads.push(uploadDeliveryPortalLinePhoto(sessionToken, line.id, file));
        }
      }
      for (const file of attachments) {
        uploads.push(uploadDeliveryPortalAttachment(sessionToken, file));
      }
      await Promise.allSettled(uploads);

      await finalizeDeliveryPortal(sessionToken);
      onSubmitted(lines);
    } catch {
      notificationService.error(t('portal.report.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-lg font-bold text-foreground">{t('portal.report.title')}</h1>
        <p className="text-sm text-muted-foreground">{po.poNumber ?? '—'}</p>
      </div>

      {/* ── Submitter card ── */}
      <div className="rounded-2xl border border-black/10 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold text-foreground">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{name || '—'}</p>
              <p className="truncate text-sm text-muted-foreground">
                {showEmail ? email : maskEmail(email)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowEmail((v) => !v)}
            aria-label={showEmail ? t('portal.report.hideContact') : t('portal.report.showContact')}
            className="text-muted-foreground"
            data-testid="portal-toggle-contact"
          >
            {showEmail ? <EyeClosedIcon className="h-5 w-5" /> : <EyeOpenIcon className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {po.poNumber && (
            <a
              href={`/po/${token}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-sm font-medium text-background"
              data-testid="portal-view-po"
            >
              <FileTextIcon className="h-4 w-4" />
              {t('portal.report.viewPo')}
            </a>
          )}
          <input
            ref={attachmentRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => attachmentRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-black/15 bg-card py-2.5 text-sm font-medium text-foreground"
            data-testid="portal-add-attachment"
          >
            <PaperclipIcon className="h-4 w-4" />
            {t('portal.report.addAttachment')}
          </button>
        </div>

        {attachments.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1" data-testid="portal-attachment-list">
            {attachments.map((file, i) => (
              <li key={`${file.name}-${i}`} className="truncate text-xs text-muted-foreground">
                {file.name}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">
            {t('portal.report.reportNotes')}{' '}
            <span className="text-muted-foreground">{t('portal.report.optional')}</span>
          </p>
          <Textarea
            rows={3}
            className="mt-1.5"
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            placeholder={t('portal.report.notesPlaceholder')}
            aria-label={t('portal.report.reportNotes')}
            data-testid="portal-overall-notes"
          />
        </div>
      </div>

      {/* ── Line items ── */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">{t('portal.report.lineItems')}</h2>
        <div className="mb-3 flex flex-wrap gap-2" role="tablist">
          {LINE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              data-testid={`portal-filter-${f}`}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filter === f ? 'bg-foreground text-background' : 'bg-muted text-foreground',
              )}
            >
              {t(`portal.report.filters.${f}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {visibleLines.map((line) => (
            <PortalLineItem
              key={line.id}
              line={line}
              onChange={(patch) => updateLine(line.id, patch)}
            />
          ))}
        </div>
      </div>

      {/* ── Submit ── */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={submitting}
        disabled={!allValid}
        onClick={() => void handleSubmit()}
        data-testid="portal-submit"
      >
        {t('portal.report.submit')}
      </Button>
    </div>
  );
}

/* ─── Step 4: Report submitted (screenshot 14) ───────────────────────────────── */

function SubmittedStep({
  poNumber,
  lines,
  onLogOut,
}: {
  poNumber: string | null;
  lines: PortalLineDraft[];
  onLogOut: () => void;
}) {
  const { t } = useTranslation('deliveries');
  const summary = useMemo(() => summarisePortalLines(lines), [lines]);

  const rows: { key: keyof typeof summary; label: string }[] = [
    { key: 'delivered', label: t('portal.submitted.delivered') },
    { key: 'notDelivered', label: t('portal.submitted.notDelivered') },
    { key: 'partialDelivered', label: t('portal.submitted.partialDelivered') },
    { key: 'damage', label: t('portal.submitted.damage') },
    { key: 'rejected', label: t('portal.submitted.rejected') },
  ];

  return (
    <PortalCard>
      <h1 className="text-center text-2xl font-bold text-foreground">{t('portal.submitted.title')}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {t('portal.submitted.subtitle', { poNumber: poNumber ?? '—' })}
      </p>

      <dl className="mt-6 flex flex-col gap-3" data-testid="portal-summary">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between">
            <dt className="text-foreground">{row.label}</dt>
            <dd className="text-muted-foreground" data-testid={`portal-summary-${row.key}`}>
              {t('portal.submitted.items', { count: summary[row.key] })}
            </dd>
          </div>
        ))}
      </dl>

      <Button
        variant="primary"
        size="lg"
        className="mt-6 w-full"
        leftIcon={<BackArrowIcon className="h-4 w-4" />}
        onClick={onLogOut}
        data-testid="portal-logout"
      >
        {t('portal.submitted.logOut')}
      </Button>
    </PortalCard>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────────────── */

/** White bordered ~48px field, matching the auth screens' AUTH_INPUT_CLASS. */
const PORTAL_INPUT_CLASS = 'h-12 rounded-lg border-black/15 bg-card text-base';

function PortalCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-card p-6 shadow-sm">{children}</div>
  );
}

const LINE_FILTERS = ['all', 'delivered', 'damaged', 'rejected'] as const;
type LineFilter = (typeof LINE_FILTERS)[number];

function matchesFilter(line: PortalLineDraft, filter: LineFilter): boolean {
  if (filter === 'all') return true;
  const outcome = resolveOutcome(line);
  if (filter === 'delivered')
    return outcome === 'DELIVERED' || outcome === 'PARTIALLY_DELIVERED';
  if (filter === 'damaged') return outcome === 'DAMAGED';
  return outcome === 'REJECTED';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  const head = local.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}
