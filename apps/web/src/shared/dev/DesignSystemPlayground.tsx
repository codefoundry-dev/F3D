/**
 * Design-system playground — DEV ONLY.
 *
 * A standalone showcase of the Forethread design-system primitives, mounted at
 * `/__ds` only when `import.meta.env.DEV` is true (see app/routes.tsx). Used by
 * the `.tmp/figma-ds` screenshot harness to verify components render on-design in
 * isolation, without needing seeded entities or feature pages. Never ships to prod.
 */
import {
  Alert,
  AvatarStack,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Divider,
  IconBadge,
  SelectDropdown,
  SegmentedControl,
  TABLE_CELL,
  TABLE_CONTAINER,
  TABLE_HEADER_CELL,
  TABLE_HEADER_ROW,
  TABLE_ROW,
  Tabs,
  type TabItem,
} from '@forethread/ui-components';
import { useState } from 'react';

const PEOPLE = [
  { name: 'Liam Johnson' },
  { name: 'Sophia Martinez' },
  { name: 'Emma Wilson' },
  { name: 'Noah Brown' },
  { name: 'Olivia Davis' },
  { name: 'Mason Clark' },
  { name: 'Ava Lewis' },
];

const HeartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-full">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const CheckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-full">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TABLE_ROWS = [
  {
    id: 'RFQ-2024-001',
    vendor: 'Acme Steel Co.',
    status: 'Open',
    color: 'green' as const,
    total: '$12,400',
  },
  {
    id: 'RFQ-2024-002',
    vendor: 'BuildRight Supply',
    status: 'Pending',
    color: 'orange' as const,
    total: '$8,150',
  },
  {
    id: 'RFQ-2024-003',
    vendor: 'Nakamura Cement',
    status: 'Closed',
    color: 'gray' as const,
    total: '$31,900',
  },
];

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
  const [vendor, setVendor] = useState('acme');

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

      <Section title="Table">
        <div className={TABLE_CONTAINER}>
          <table className="w-full border-collapse">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className={TABLE_HEADER_CELL}>RFQ #</th>
                <th className={TABLE_HEADER_CELL}>Vendor</th>
                <th className={TABLE_HEADER_CELL}>Status</th>
                <th className={`${TABLE_HEADER_CELL} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map((row) => (
                <tr key={row.id} className={TABLE_ROW}>
                  <td className={`${TABLE_CELL} font-semibold`}>{row.id}</td>
                  <td className={TABLE_CELL}>{row.vendor}</td>
                  <td className={TABLE_CELL}>
                    <Badge color={row.color} dot>
                      {row.status}
                    </Badge>
                  </td>
                  <td className={`${TABLE_CELL} text-right tabular-nums`}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-wrap items-center gap-8">
          <AvatarStack people={PEOPLE} />
          <AvatarStack people={PEOPLE.slice(0, 3)} size={28} onAdd={() => undefined} />
        </div>
      </Section>

      <Section title="Activity icons (IconBadge)">
        <div className="flex flex-wrap items-center gap-3">
          <IconBadge color="brand" icon={HeartIcon} />
          <IconBadge color="blue" icon={HeartIcon} />
          <IconBadge color="green" icon={HeartIcon} />
          <IconBadge color="purple" icon={HeartIcon} />
          <IconBadge color="red" icon={HeartIcon} size="md" />
          <IconBadge color="gray" icon={HeartIcon} size="sm" />
        </div>
      </Section>

      <Section title="Select dropdown">
        <div className="flex max-w-xs flex-col gap-2" data-testid="ds-select">
          <SelectDropdown
            value={vendor}
            onChange={setVendor}
            options={[
              { value: 'acme', label: 'Acme Steel Co.' },
              { value: 'buildright', label: 'BuildRight Supply' },
              { value: 'nakamura', label: 'Nakamura Cement' },
            ]}
            placeholder="Select a vendor"
          />
        </div>
      </Section>

      <Section title="Card + Divider">
        <Card className="max-w-sm">
          <h3 className="text-[15px] font-semibold text-gray-900">Card title</h3>
          <p className="mt-1 text-[13px] text-gray-500">
            A white DS surface with a hairline border and shadow-xs.
          </p>
          <Divider className="my-3" />
          <Divider label="OR" className="my-1" />
        </Card>
      </Section>

      <Section title="Alerts">
        <div className="flex max-w-xl flex-col gap-3">
          <Alert
            variant="success"
            icon={CheckIcon}
            title="Payment received"
            onClose={() => undefined}
          >
            The vendor invoice has been marked as paid.
          </Alert>
          <Alert variant="warning" icon={CheckIcon}>
            This RFQ closes in 2 days — responses are still pending.
          </Alert>
          <Alert
            variant="destructive"
            icon={CheckIcon}
            title="Upload failed"
            actions={
              <>
                <Button size="sm" variant="primary">
                  Retry
                </Button>
                <Button size="sm" variant="secondary">
                  Dismiss
                </Button>
              </>
            }
          >
            The file exceeded the 25&nbsp;MB limit.
          </Alert>
          <Alert variant="info" icon={CheckIcon}>
            A new catalogue version is available.
          </Alert>
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
