import { useTranslation } from '@forethread/i18n';
import { Checkbox, Input } from '@forethread/ui-components';

import type { PermissionGroup } from '../hooks/usePermissionGroups';

/** Empty input = unlimited (null in DTO). Otherwise must parse as a finite number ≥ 0. */
export function parseThresholdInput(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
  return parsed;
}

interface PermissionGridProps {
  grouped: PermissionGroup[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  thresholdInputs: Record<string, string>;
  onThresholdChange: (key: string, value: string) => void;
  disabled?: boolean;
}

/**
 * Grouped permission checkboxes with inline threshold inputs for granted
 * threshold-aware permissions. Shared by the built-in RoleEditPage and the
 * custom-role editor (FOR-252) so both stay visually and behaviourally
 * identical.
 */
export function PermissionGrid({
  grouped,
  selected,
  onToggle,
  thresholdInputs,
  onThresholdChange,
  disabled = false,
}: PermissionGridProps) {
  const { t } = useTranslation('roles');

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <section
          key={group.domain}
          className="rounded-[12px] border border-gray-100 bg-white p-5 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]"
          data-testid={`group-${group.domain}`}
        >
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            {t(`domains.${group.domain}`)}
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {group.entries.map((entry) => {
              const isChecked = selected.has(entry.key);
              const showThreshold = entry.thresholdAware && isChecked;
              return (
                <li key={entry.key}>
                  <Checkbox
                    checked={isChecked}
                    onChange={() => onToggle(entry.key)}
                    disabled={disabled}
                    label={entry.description}
                  />
                  <p className="ml-7 font-mono text-xs text-gray-500">{entry.key}</p>
                  {showThreshold && (
                    <div className="ml-7 mt-2 w-40">
                      <label
                        htmlFor={`threshold-${entry.key}`}
                        className="mb-1 block text-xs font-medium text-gray-900"
                      >
                        {t('thresholdLabel')}
                      </label>
                      <Input
                        id={`threshold-${entry.key}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        inputSize="sm"
                        value={thresholdInputs[entry.key] ?? ''}
                        placeholder={t('thresholdPlaceholder')}
                        onChange={(e) => onThresholdChange(entry.key, e.target.value)}
                        disabled={disabled}
                        data-testid={`threshold-${entry.key}`}
                      />
                      <p className="mt-1 text-xs text-gray-500">{t('thresholdHint')}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
