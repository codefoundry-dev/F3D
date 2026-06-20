/**
 * Design-system playground — DEV ONLY.
 *
 * A standalone showcase of the Forethread design-system primitives, mounted at
 * `/__ds` only when `import.meta.env.DEV` is true (see app/routes.tsx). Used by
 * the `.tmp/figma-ds` screenshot harness to verify components render on-design in
 * isolation, without needing seeded entities or feature pages. Never ships to prod.
 */
import {
  Badge,
  Breadcrumbs,
  Button,
  SegmentedControl,
  Tabs,
  type TabItem,
} from '@forethread/ui-components';
import { useState } from 'react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-gray-100 py-8">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

const TAB_ITEMS: TabItem[] = [
  { value: 'details', label: 'Details' },
  { value: 'lineItems', label: 'Line items' },
  { value: 'responses', label: 'Responses', count: 4 },
  { value: 'documents', label: 'Documents' },
  { value: 'audit', label: 'Audit', disabled: true },
];

export default function DesignSystemPlayground() {
  const [tab, setTab] = useState('details');
  const [view, setView] = useState('list');

  return (
    <div className="mx-auto max-w-[960px] px-10 py-10" data-testid="ds-playground">
      <h1 className="text-2xl font-semibold text-gray-900">Design System</h1>

      <Section title="Breadcrumbs">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '#', icon: <span className="text-[14px]">⌂</span> },
            { label: 'Purchase Orders', href: '#' },
            { label: 'PO-2024-014' },
          ]}
        />
      </Section>

      <Section title="Tabs">
        <Tabs items={TAB_ITEMS} value={tab} onValueChange={setTab} />
        <Tabs
          items={TAB_ITEMS.slice(0, 4)}
          value={tab}
          onValueChange={setTab}
          size="sm"
          rightSlot={
            <Button size="sm" variant="secondary">
              Action
            </Button>
          }
        />
      </Section>

      <Section title="Segmented control (Switcher)">
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl
            items={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Calendar' },
            ]}
            value={view}
            onValueChange={setView}
          />
          <SegmentedControl
            size="sm"
            items={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
            ]}
            value={view}
            onValueChange={setView}
          />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="green" dot>
            Active
          </Badge>
          <Badge color="orange" dot>
            Pending
          </Badge>
          <Badge color="blue">Info</Badge>
          <Badge color="red" dot>
            Error
          </Badge>
          <Badge color="gray" onRemove={() => undefined}>
            Removable
          </Badge>
        </div>
      </Section>
    </div>
  );
}
