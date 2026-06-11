import {
  createMaterial,
  getMaterialCategories,
  type MaterialListItemDto,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  CustomDropdown,
  FormField,
  Input,
  Modal,
  Textarea,
  notificationService,
} from '@forethread/ui-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export interface CreatePrivateMaterialModalProps {
  /** Seed values from the BOM line being resolved. */
  initialName?: string;
  initialUom?: string;
  initialDescription?: string;
  onClose: () => void;
  onCreated: (material: MaterialListItemDto) => void;
}

/**
 * "Create private material item" — creates a company material (it enters the
 * catalogue as PENDING_APPROVAL) and matches it to the BOM line that opened
 * the modal. Same flow as RFQ creation per the US 5.01 design annotation.
 */
export function CreatePrivateMaterialModal({
  initialName,
  initialUom,
  initialDescription,
  onClose,
  onCreated,
}: CreatePrivateMaterialModalProps) {
  const { t } = useTranslation('boms');
  const [name, setName] = useState(initialName ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [uom, setUom] = useState(initialUom ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['materials', 'categories'],
    queryFn: () => getMaterialCategories(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMaterial({
        name: name.trim(),
        unitOfMeasure: uom.trim(),
        categoryId: categoryId || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: (material) => {
      notificationService.success(t('privateMaterial.created', { name: material.name }));
      onCreated(material);
    },
    onError: () => setError(t('privateMaterial.createError')),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setError(t('privateMaterial.nameRequired'));
      return;
    }
    if (!uom.trim()) {
      setError(t('privateMaterial.uomRequired'));
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground">{t('privateMaterial.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{t('privateMaterial.subtitle')}</p>

        <div className="space-y-4">
          <FormField label={t('privateMaterial.nameLabel')}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="private-material-name"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('privateMaterial.categoryLabel')}>
              <CustomDropdown
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId}
                onChange={setCategoryId}
                searchable
              />
            </FormField>
            <FormField label={t('privateMaterial.uomLabel')}>
              <Input
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                data-testid="private-material-uom"
              />
            </FormField>
          </div>

          <FormField label={t('privateMaterial.descriptionLabel')}>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            {t('privateMaterial.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={createMutation.isPending}
            data-testid="private-material-submit"
          >
            {t('privateMaterial.createAndMatch')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
