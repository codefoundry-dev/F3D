import { useTranslation } from '@forethread/i18n';
import { GridModal, Input, Textarea, Select, FileDropzone } from '@forethread/ui-components';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useState } from 'react';

import { useUploadMrLinePhoto } from '../services/material-requests.service';

import { PrimaryButton } from './MobileButtons';

/** Payload emitted when a free-text material is added on the Manual tab. */
export interface NewMaterialDraft {
  materialName: string;
  unit: string;
  quantity: number;
  description?: string;
  /**
   * Catalogue material linked from the inline manual row's name search. Set
   * only when the name was picked from the suggestions popup, so the request is
   * raised against the real material instead of a loose name.
   */
  materialId?: string;
  /**
   * Image shown on the line, never sent: the uploaded photo's preview, or the
   * catalogue image of the linked material.
   */
  imageUrl?: string | null;
  /** File id of the photo uploaded in this modal (FOR-404); sent with the line. */
  photoFileId?: string;
}

/** Mirrors the backend's line-photo limits so a bad file fails before upload. */
const PHOTO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

type PhotoError = 'type' | 'size' | 'upload';

interface UploadedPhoto {
  fileId: string;
  fileName: string;
  /** Local object URL of the picked file, so the preview never expires. */
  previewUrl: string;
}

export interface NewMaterialModalProps {
  onClose: () => void;
  onAdd: (draft: NewMaterialDraft) => void;
}

const UNIT_OPTION_KEYS = [
  ['Each', 'newMaterial.unitEach'],
  ['Box', 'newMaterial.unitBox'],
  ['Roll', 'newMaterial.unitRoll'],
  ['Sheet', 'newMaterial.unitSheet'],
  ['Gallon', 'newMaterial.unitGallon'],
  ['Bag', 'newMaterial.unitBag'],
  ['Linear Foot', 'newMaterial.unitLinearFoot'],
  ['Square Foot', 'newMaterial.unitSquareFoot'],
  ['Cubic Yard', 'newMaterial.unitCubicYard'],
] as const;

/**
 * "New Material" modal (Figma 2002:176 frames 2157:1261 / 2157:1266). Captures a
 * free-text line: name*, unit, quantity*, optional photo + description.
 *
 * The photo is uploaded as soon as it is picked (FOR-404): the request is
 * created in one call later, so the line carries the returned file id. Add is
 * held while an upload is in flight so a line is never added without the photo
 * the requester just chose.
 */
export function NewMaterialModal({ onClose, onAdd }: NewMaterialModalProps) {
  const { t } = useTranslation('materialRequests');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>('Each');
  const [quantity, setQuantity] = useState('0');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<PhotoError | null>(null);
  const [touched, setTouched] = useState(false);
  const uploadPhoto = useUploadMrLinePhoto();

  const qtyNum = Number(quantity);
  const nameValid = name.trim().length > 0;
  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;
  const canAdd = nameValid && qtyValid && !uploadPhoto.isPending;

  const handlePhoto = (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    if (!PHOTO_MIME_TYPES.includes(file.type)) {
      setPhotoError('type');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError('size');
      return;
    }
    setPhotoError(null);
    uploadPhoto.mutate(file, {
      onSuccess: (uploaded) => {
        setPhoto((previous) => {
          if (previous) URL.revokeObjectURL(previous.previewUrl);
          return {
            fileId: uploaded.fileId,
            fileName: uploaded.fileName,
            previewUrl: URL.createObjectURL(file),
          };
        });
      },
      onError: () => setPhotoError('upload'),
    });
  };

  const removePhoto = () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    setPhotoError(null);
  };

  const handleAdd = () => {
    setTouched(true);
    if (!canAdd) return;
    onAdd({
      materialName: name.trim(),
      unit,
      quantity: qtyNum,
      description: description.trim() || undefined,
      photoFileId: photo?.fileId,
      imageUrl: photo?.previewUrl,
    });
  };

  return (
    <GridModal
      onClose={onClose}
      icon={<PackageIcon className="size-6 text-gray-700" />}
      title={t('newMaterial.title')}
      scrollBody
      actions={
        <PrimaryButton
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full"
          data-testid="mr-new-material-add"
        >
          {t('newMaterial.add')}
        </PrimaryButton>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.materialName')}
            <span className="text-muted-foreground">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('newMaterial.materialNamePlaceholder')}
            aria-label={t('newMaterial.materialName')}
            data-testid="mr-new-material-name"
          />
          {touched && !nameValid && (
            <p className="text-xs text-destructive">{t('newMaterial.materialName')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('newMaterial.unit')}</label>
          <Select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label={t('newMaterial.unit')}
          >
            {UNIT_OPTION_KEYS.map(([value, key]) => (
              <option key={value} value={value}>
                {t(key as never)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.quantity')}
            <span className="text-muted-foreground">*</span>
          </label>
          <Input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label={t('newMaterial.quantity')}
            data-testid="mr-new-material-qty"
          />
          {touched && !qtyValid && (
            <p className="text-xs text-destructive">{t('newMaterial.quantity')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.addPhoto')}
            <span className="text-muted-foreground">({t('newMaterial.optional')})</span>
          </label>
          {photo ? (
            <div
              className="flex items-center gap-3 rounded-lg border border-border p-2"
              data-testid="mr-new-material-photo"
            >
              <img
                src={photo.previewUrl}
                alt={photo.fileName}
                className="size-12 shrink-0 rounded-md border border-border object-cover"
              />
              <p className="min-w-0 flex-1 truncate text-sm text-foreground" title={photo.fileName}>
                {photo.fileName}
              </p>
              <button
                type="button"
                onClick={removePhoto}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                data-testid="mr-new-material-photo-remove"
              >
                {t('newMaterial.removePhoto')}
              </button>
            </div>
          ) : (
            <FileDropzone
              accept="image/png,image/jpeg,image/webp"
              buttonLabel={t('newMaterial.addPhotoHint')}
              hint={t('newMaterial.addPhotoFormats')}
              onFiles={handlePhoto}
            />
          )}
          {uploadPhoto.isPending && (
            <p className="text-xs text-muted-foreground" role="status">
              {t('newMaterial.photoUploading')}
            </p>
          )}
          {photoError && (
            <p
              className="text-xs text-destructive"
              role="alert"
              data-testid="mr-new-material-photo-error"
            >
              {t(
                photoError === 'type'
                  ? 'newMaterial.photoTypeError'
                  : photoError === 'size'
                    ? 'newMaterial.photoSizeError'
                    : 'newMaterial.photoUploadError',
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.description')}
            <span className="text-muted-foreground">({t('newMaterial.optional')})</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('newMaterial.descriptionPlaceholder')}
            rows={3}
            aria-label={t('newMaterial.description')}
          />
        </div>
      </div>
    </GridModal>
  );
}
