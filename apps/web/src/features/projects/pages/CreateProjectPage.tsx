import { searchAddresses } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  createProjectSchema,
  type CreateProjectFormValues,
  LocationType,
  ProjectStatus,
} from '@forethread/shared-types/client';
import {
  Input,
  AddressInput,
  Textarea,
  CustomDropdown,
  Checkbox,
  RadioButton,
  FormField,
  Button,
  Alert,
  buttonVariants,
  DatePicker,
  onDecimalOnly,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useCreateProject, useCompanyUsers } from '../services/projects.service';

const projectTypes = [
  'Residential',
  'Commercial',
  'Industrial',
  'Infrastructure',
  'MixedUse',
] as const;
const currencies = ['AUD', 'USD', 'GBP', 'EUR', 'NZD'];

export default function CreateProjectPage() {
  const { t } = useTranslation('projects');
  const createMutation = useCreateProject();
  const { data: companyUsers = [] } = useCompanyUsers();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      type: '',
      status: ProjectStatus.PLANNED,
      plannedBudget: undefined,
      currency: 'AUD',
      startDate: '',
      expectedEndDate: '',
      locations: [
        { type: LocationType.DELIVERY, address: '', label: '', isDefault: true },
        { type: LocationType.STORAGE, address: '', label: '', isDefault: true },
      ],
      assignedUserIds: [],
      pointOfContactId: '',
    },
  });

  const {
    fields: locationFields,
    append: appendLocation,
    remove: removeLocation,
  } = useFieldArray({ control, name: 'locations' });

  const watchedLocations = watch('locations');
  const assignedUserIds = watch('assignedUserIds');

  const deliveryLocations = locationFields
    .map((field, index) => ({ field, index }))
    .filter(
      (_, i) => watchedLocations[locationFields[i]?.id ? i : i]?.type === LocationType.DELIVERY,
    );
  const storageLocations = locationFields
    .map((field, index) => ({ field, index }))
    .filter((_, i) => watchedLocations[i]?.type === LocationType.STORAGE);

  const setDefaultLocation = (targetIndex: number, locType: LocationType) => {
    watchedLocations.forEach((loc, i) => {
      if (loc.type === locType) {
        setValue(`locations.${i}.isDefault`, i === targetIndex);
      }
    });
  };

  const handleAddressSearch = useCallback((input: string) => searchAddresses(input), []);

  const projectTypeOptions = projectTypes.map((pt) => ({
    value: pt,
    label: t(`types.${pt}`),
  }));

  const statusOptions = [
    { value: ProjectStatus.PLANNED, label: t('statuses.PLANNED') },
    { value: ProjectStatus.ONGOING, label: t('statuses.ONGOING') },
  ];

  const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

  const pointOfContactOptions = companyUsers
    .filter((u) => assignedUserIds?.includes(u.id))
    .map((user) => ({ value: user.id, label: user.name }));

  const onSubmit = (data: CreateProjectFormValues) => {
    createMutation.mutate({
      ...data,
      type: data.type ?? undefined,
      plannedBudget: data.plannedBudget ?? undefined,
      pointOfContactId: data.pointOfContactId ?? undefined,
      startDate: data.startDate ?? undefined,
      expectedEndDate: data.expectedEndDate ?? undefined,
    });
  };

  const is409 =
    createMutation.isError &&
    isAxiosError(createMutation.error) &&
    createMutation.error.response?.status === 409;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('create.title')}</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-8" noValidate>
        {/* Project Details */}
        <section className="bg-card rounded-lg border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('create.projectDetails')}</h2>

          <FormField label={t('create.name')} error={errors.name?.message}>
            <Input {...register('name')} placeholder={t('create.namePlaceholder')} />
          </FormField>

          <FormField label={t('create.description')}>
            <Textarea
              {...register('description')}
              rows={3}
              placeholder={t('create.descriptionPlaceholder')}
            />
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
                    placeholder={t('create.selectType')}
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
                placeholder={t('create.budgetPlaceholder')}
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
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    minDate={new Date().toISOString().slice(0, 10)}
                  />
                )}
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
                  name="deliveryDefault"
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
                  name="storageDefault"
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

        {/* Team Members */}
        <section className="bg-card rounded-lg border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('create.teamMembers')}</h2>

          <FormField label={t('create.selectMembers')} error={errors.assignedUserIds?.message}>
            <Controller
              name="assignedUserIds"
              control={control}
              render={({ field }) => (
                <div className="border border-input rounded-md p-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {companyUsers.map((user) => (
                    <Checkbox
                      key={user.id}
                      checked={field.value?.includes(user.id) ?? false}
                      onChange={(checked) => {
                        const current = field.value ?? [];
                        field.onChange(
                          checked ? [...current, user.id] : current.filter((id) => id !== user.id),
                        );
                      }}
                      label={`${user.name} (${user.email})`}
                    />
                  ))}
                </div>
              )}
            />
          </FormField>

          <FormField label={t('create.pointOfContact')}>
            <Controller
              name="pointOfContactId"
              control={control}
              render={({ field }) => (
                <CustomDropdown
                  options={pointOfContactOptions}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder={t('create.selectPointOfContact')}
                />
              )}
            />
          </FormField>
        </section>

        {/* Errors */}
        {createMutation.isError && (
          <Alert variant="destructive">
            {is409 ? t('create.duplicateNameError') : t('create.createError')}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" isLoading={createMutation.isPending}>
            {createMutation.isPending ? t('create.creating') : t('create.submit')}
          </Button>
          <Link to={ROUTES.projects} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            {t('edit.cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
