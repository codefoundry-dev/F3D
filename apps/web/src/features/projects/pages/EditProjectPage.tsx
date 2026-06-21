import { searchAddresses } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  updateProjectSchema,
  type UpdateProjectFormValues,
  LocationType,
  ProjectStatus,
} from '@forethread/shared-types/client';
import {
  Input,
  AddressInput,
  Textarea,
  CustomDropdown,
  RadioButton,
  FormField,
  Button,
  Spinner,
  Alert,
  buttonVariants,
  DatePicker,
  onDecimalOnly,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useCallback, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useParams, Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useProject, useUpdateProject } from '../services/projects.service';

const projectTypes = [
  'Residential',
  'Commercial',
  'Industrial',
  'Infrastructure',
  'MixedUse',
] as const;
const currencies = ['AUD', 'USD', 'GBP', 'EUR', 'NZD'];

// Valid status transitions
const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.PLANNED]: [ProjectStatus.PLANNED, ProjectStatus.ONGOING, ProjectStatus.ARCHIVED],
  [ProjectStatus.ONGOING]: [ProjectStatus.ONGOING, ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [ProjectStatus.ARCHIVED],
};

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id ?? '');
  const updateMutation = useUpdateProject(id ?? '');

  // App-bar breadcrumb: Projects › Edit Project.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('edit.title'), null, ROUTES.projects, [
      { label: t('list.title'), to: ROUTES.projects },
      { label: t('edit.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateProjectFormValues>({
    resolver: zodResolver(updateProjectSchema),
  });

  const {
    fields: locationFields,
    append: appendLocation,
    remove: removeLocation,
  } = useFieldArray({ control, name: 'locations' });

  const watchedLocations = watch('locations') ?? [];

  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description ?? '',
        type: project.type ?? '',
        status: project.status as ProjectStatus,
        plannedBudget: project.plannedBudget ?? undefined,
        currency: project.currency,
        startDate: project.startDate ? project.startDate.split('T')[0] : '',
        expectedEndDate: project.expectedEndDate ? project.expectedEndDate.split('T')[0] : '',
        locations: project.locations.map((l) => ({
          type: l.type as LocationType,
          address: l.address,
          label: l.label ?? '',
          isDefault: l.isDefault,
        })),
      });
    }
  }, [project, reset]);

  const deliveryLocations = locationFields
    .map((field, index) => ({ field, index }))
    .filter((_, i) => watchedLocations[i]?.type === LocationType.DELIVERY);
  const storageLocations = locationFields
    .map((field, index) => ({ field, index }))
    .filter((_, i) => watchedLocations[i]?.type === LocationType.STORAGE);

  const setDefaultLocation = (targetIndex: number, locType: LocationType) => {
    watchedLocations.forEach((loc, i) => {
      if (loc?.type === locType) {
        setValue(`locations.${i}.isDefault`, i === targetIndex);
      }
    });
  };

  const handleAddressSearch = useCallback((input: string) => searchAddresses(input), []);

  const allowedStatuses: ProjectStatus[] = project
    ? (VALID_TRANSITIONS[project.status as ProjectStatus] ?? [project.status as ProjectStatus])
    : [];

  const projectTypeOptions = projectTypes.map((pt) => ({
    value: pt,
    label: t(`types.${pt}`),
  }));

  const statusOptions = allowedStatuses.map((s) => ({
    value: s,
    label: t(`statuses.${s}`),
  }));

  const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

  const onSubmit = (data: UpdateProjectFormValues) => {
    updateMutation.mutate(
      {
        ...data,
        type: data.type ?? undefined,
        plannedBudget: data.plannedBudget ?? undefined,
        startDate: data.startDate ?? undefined,
        expectedEndDate: data.expectedEndDate ?? undefined,
      },
      {
        onSuccess: () => navigate(ROUTES.projectDetail.replace(':id', id ?? '')),
      },
    );
  };

  const is409 =
    updateMutation.isError &&
    isAxiosError(updateMutation.error) &&
    updateMutation.error.response?.status === 409;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-destructive">{t('detail.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('edit.title')}</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-8" noValidate>
        {/* Project Details */}
        <section className="bg-card rounded-lg border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('create.projectDetails')}</h2>

          <FormField label={t('create.name')} error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>

          <FormField label={t('create.description')}>
            <Textarea {...register('description')} rows={3} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('create.type')}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={projectTypeOptions}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('create.selectType')}
                  />
                )}
              />
            </FormField>

            <FormField label={t('create.status')}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={statusOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('create.budget')}>
              <Input
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                onKeyDown={onDecimalOnly}
                {...register('plannedBudget', { valueAsNumber: true })}
              />
            </FormField>
            <FormField label={t('create.currency')}>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={currencyOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('create.startDate')}>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
              />
            </FormField>
            <FormField label={t('create.expectedEndDate')} error={errors.expectedEndDate?.message}>
              <Controller
                control={control}
                name="expectedEndDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    minDate={new Date().toISOString().slice(0, 10)}
                  />
                )}
              />
            </FormField>
          </div>
        </section>

        {/* Delivery Locations */}
        <section className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {t('create.deliveryLocations')}
            </h2>
            <button
              type="button"
              onClick={() =>
                appendLocation({
                  type: LocationType.DELIVERY,
                  address: '',
                  label: '',
                  isDefault: false,
                })
              }
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {t('create.addLocation')}
            </button>
          </div>

          {deliveryLocations.map(({ index }) => (
            <div key={locationFields[index].id} className="flex gap-3 items-start">
              <div className="flex-1">
                <AddressInput
                  value={watchedLocations[index]?.address ?? ''}
                  placeholder={t('create.addressPlaceholder')}
                  searchFn={handleAddressSearch}
                  onChange={(val) => setValue(`locations.${index}.address`, val)}
                />
              </div>
              <div className="w-40">
                <Input
                  {...register(`locations.${index}.label`)}
                  placeholder={t('create.labelPlaceholder')}
                />
              </div>
              <div className="pt-2.5">
                <RadioButton
                  checked={watchedLocations[index]?.isDefault ?? false}
                  onChange={() => setDefaultLocation(index, LocationType.DELIVERY)}
                  label={t('create.default')}
                  name="editDeliveryDefault"
                />
              </div>
              {deliveryLocations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLocation(index)}
                  className="p-1.5 pt-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('create.removeLocation')}
                >
                  <DeleteIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {errors.locations && (
            <p className="text-xs text-destructive">
              {errors.locations.message ?? errors.locations.root?.message}
            </p>
          )}
        </section>

        {/* Storage Locations */}
        <section className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {t('create.storageLocations')}
            </h2>
            <button
              type="button"
              onClick={() =>
                appendLocation({
                  type: LocationType.STORAGE,
                  address: '',
                  label: '',
                  isDefault: false,
                })
              }
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {t('create.addLocation')}
            </button>
          </div>

          {storageLocations.map(({ index }) => (
            <div key={locationFields[index].id} className="flex gap-3 items-start">
              <div className="flex-1">
                <AddressInput
                  value={watchedLocations[index]?.address ?? ''}
                  placeholder={t('create.addressPlaceholder')}
                  searchFn={handleAddressSearch}
                  onChange={(val) => setValue(`locations.${index}.address`, val)}
                />
              </div>
              <div className="w-40">
                <Input
                  {...register(`locations.${index}.label`)}
                  placeholder={t('create.labelPlaceholder')}
                />
              </div>
              <div className="pt-2.5">
                <RadioButton
                  checked={watchedLocations[index]?.isDefault ?? false}
                  onChange={() => setDefaultLocation(index, LocationType.STORAGE)}
                  label={t('create.default')}
                  name="editStorageDefault"
                />
              </div>
              {storageLocations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLocation(index)}
                  className="p-1.5 pt-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('create.removeLocation')}
                >
                  <DeleteIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </section>

        {/* Errors */}
        {updateMutation.isError && (
          <Alert variant="destructive">
            {is409 ? t('edit.duplicateNameError') : t('edit.updateError')}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" isLoading={updateMutation.isPending}>
            {updateMutation.isPending ? t('edit.saving') : t('edit.save')}
          </Button>
          <Link
            to={ROUTES.projectDetail.replace(':id', id ?? '')}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            {t('edit.cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
