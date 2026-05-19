import { useState } from 'react';

import EyeIcon from '../assets/icons/eye-opened.svg?react';

import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { Input } from './Input';
import { Modal, ModalCloseButton } from './Modal';

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
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <div className="px-6 pt-6 pb-2">
        <div className="flex justify-end">
          <ModalCloseButton onClose={onClose} />
        </div>
        <div className="flex flex-col items-center gap-2 mb-6">
          <IconBadge icon={<EyeIcon className="w-5 h-5" />} />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground text-center">{subtitle}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {viewNameLabel}
          </label>
          <Input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder={viewNamePlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
        </div>

        <div className="flex flex-col gap-3 pb-4">
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
        </div>
      </div>
    </Modal>
  );
}
