import PlusIcon from '../assets/icons/plus.svg?react';
import { cn } from '../utils/cn';

/**
 * AvatarStack — Forethread design system (Figma "Avatars" node 3608-72397).
 *
 * A row of overlapping circular avatars, each ringed in white, collapsing into a
 * grey "+N" overflow chip once the count exceeds `max`. Photos render when
 * available, otherwise a neutral initials circle. An optional trailing add
 * button (dashed plus) appends a "+" affordance.
 */
export interface AvatarStackPerson {
  name: string;
  avatarUrl?: string | null;
}

export interface AvatarStackProps {
  people: AvatarStackPerson[];
  /** Max avatars shown before collapsing into a +N chip. Default 5. */
  max?: number;
  /** Avatar diameter in px. Default 32. */
  size?: number;
  /** Show a trailing dashed "+" add button. */
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
}

export function AvatarStack({
  people,
  max = 5,
  size = 32,
  onAdd,
  addLabel = 'Add user',
  className,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const overlap = Math.round(size * 0.3);
  const ring = Math.max(2, Math.round(size * 0.06));

  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((person, index) => {
        const initial = person.name?.charAt(0).toUpperCase() ?? '?';
        return (
          <div
            key={index}
            title={person.name}
            className="relative shrink-0 overflow-hidden rounded-full bg-white"
            style={{
              width: size,
              height: size,
              marginLeft: index === 0 ? 0 : -overlap,
              padding: ring,
              zIndex: index,
            }}
          >
            {person.avatarUrl ? (
              <img
                src={person.avatarUrl}
                alt={person.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600"
                style={{ fontSize: size * 0.4 }}
              >
                {initial}
              </div>
            )}
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          className="relative flex shrink-0 items-center justify-center rounded-full bg-white"
          style={{
            width: size,
            height: size,
            marginLeft: -overlap,
            padding: ring,
            zIndex: shown.length,
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600"
            style={{ fontSize: size * 0.34 }}
          >
            +{overflow}
          </div>
        </div>
      )}

      {onAdd && (
        <button
          type="button"
          aria-label={addLabel}
          onClick={onAdd}
          className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            width: size,
            height: size,
            marginLeft: people.length ? -overlap : 0,
            zIndex: shown.length + 1,
          }}
        >
          <PlusIcon style={{ width: size * 0.4, height: size * 0.4 }} />
        </button>
      )}
    </div>
  );
}
