import { useState } from 'react';

import EyeIcon from '../assets/icons/eye-opened.svg?react';

import { Button } from './Button';
import { GridModal } from './GridModal';
import { Input } from './Input';

export interface CreateViewModalProps {
  onClose: () => void;
  onCreate: (name: string) => void;
  title?: string;
  subtitle?: string;
  viewNameLabel?: string;
  viewNamePlaceholder?: string;
  createLabel?: string;
  cancelLabel?: string;
}

export function CreateViewModal({
  onClose,
  onCreate,
  title = 'Create view option',
  subtitle = 'Save the current table configuration as a named view',
  viewNameLabel = 'View name',
  viewNamePlaceholder = 'Enter view name',
  createLabel = 'Create view',
  cancelLabel = 'Cancel',
}: CreateViewModalProps) {
  const [viewName, setViewName] = useState('');

  const handleCreate = () => {
    const trimmed = viewName.trim();
    if (trimmed) {
      onCreate(trimmed);
    }
  };

  return (
    <GridModal
      onClose={onClose}
      icon={<EyeIcon className="size-6 text-gray-700" />}
      title={title}
      description={subtitle}
      actions={
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={handleCreate}
            disabled={!viewName.trim()}
            className="w-full"
          >
            {createLabel}
          </Button>
          <Button variant="outline" size="lg" onClick={onClose} className="w-full">
            {cancelLabel}
          </Button>
        </>
      }
    >
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">{viewNameLabel}</label>
        <Input
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          placeholder={viewNamePlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
      </div>
    </GridModal>
  );
}
