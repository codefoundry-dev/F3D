import { searchAddresses } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Stepper } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  createProjectSchema,
  type CreateProjectFormValues,
  LocationType,
  ProjectStatus,
  UserRole,
} from '@forethread/shared-types/client';
import {
  Input,
  AddressInput,
  Textarea,
  CustomDropdown,
  FormField,
  Button,
  Alert,
  AvatarWithStatus,
  cn,
  DatePicker,
  onDecimalOnly,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import FlagIcon from '@forethread/ui-components/assets/icons/flag.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  useForm,
  useFieldArray,
  Controller,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';

import { PROJECT_TYPES } from '../constants';
import { useCreateProject, useCompanyUsers } from '../services/projects.service';

type TFn = (key: string, options?: Record<string, unknown>) => string;

const STATUS_CHIPS = [
  ProjectStatus.PLANNED,
  ProjectStatus.ONGOING,
  ProjectStatus.COMPLETED,
] as const;

/** Empty / whitespace string → undefined (so optional API fields are omitted). */
const blankToUndefined = (v?: string): string | undefined => (v?.trim() ? v : undefined);

export default function CreateProjectPage() {
  const { t: tRaw } = useTranslation('projects');
  const t = tRaw as TFn;
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isProcurementOfficer = currentUser?.role === UserRole.PROCUREMENT_OFFICER;

  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  // Header (title + back arrow) is owned by the app shell.
  useEffect(() => {
    setPageTitle(t('create.title'), t('create.subtitle'), ROUTES.projects);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const createMutation = useCreateProject();
  const { data: companyUsers = [] } = useCompanyUsers();

  const [step, setStep] = useState(1);
  // Files are staged locally only — there is no backend to persist project
  // documents at create time.
  // TODO(US5.03): persist project documents once ProjectDocument backend exists
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const form = useForm<CreateProjectFormValues>({
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
      // A Procurement Officer is auto-assigned server-side; prefill so the
      // required (min 1) validation passes and the chip renders locked.
      assignedUserIds: isProcurementOfficer && currentUser ? [currentUser.id] : [],
      // Keep undefined (not '') — the schema validates this as an optional UUID,
      // and an empty string would fail `.uuid()` and block the wizard.
      pointOfContactId: undefined,
    },
  });

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = form;

  const { fields: locationFields, append, remove } = useFieldArray({ control, name: 'locations' });

  const watchedLocations = watch('locations');
  const assignedUserIds = watch('assignedUserIds') ?? [];

  const deliveryIndexes = locationFields
    .map((_, index) => index)
    .filter((i) => watchedLocations[i]?.type === LocationType.DELIVERY);
  const storageIndexes = locationFields
    .map((_, index) => index)
    .filter((i) => watchedLocations[i]?.type === LocationType.STORAGE);

  const setDefaultLocation = (targetIndex: number, locType: LocationType) => {
    watchedLocations.forEach((loc, i) => {
      if (loc.type === locType) setValue(`locations.${i}.isDefault`, i === targetIndex);
    });
  };

  const handleAddressSearch = useCallback((input: string) => searchAddresses(input), []);

  const typeOptions = PROJECT_TYPES.map((pt) => ({ value: pt, label: t(`types.${pt}`) }));

  // Users available to assign / be point of contact.
  const assignableUsers = isProcurementOfficer
    ? companyUsers.filter((u) => u.id === currentUser?.id)
    : companyUsers;
  const selectedUsers = assignableUsers.filter((u) => assignedUserIds.includes(u.id));
  const pointOfContactOptions = selectedUsers.map((u) => ({ value: u.id, label: u.name }));

  const toggleUser = (userId: string) => {
    const current = watch('assignedUserIds') ?? [];
    setValue(
      'assignedUserIds',
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
      { shouldValidate: true },
    );
  };

  const addFiles = (files: FileList | File[]) => {
    setStagedFiles((prev) => [...prev, ...Array.from(files)]);
  };
  const removeFile = (index: number) =>
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));

  const onSubmit = (data: CreateProjectFormValues) => {
    createMutation.mutate({
      ...data,
      type: blankToUndefined(data.type),
      plannedBudget: data.plannedBudget ?? undefined,
      pointOfContactId: blankToUndefined(data.pointOfContactId),
      startDate: blankToUndefined(data.startDate),
      expectedEndDate: blankToUndefined(data.expectedEndDate),
    });
  };

  // Step 2 fields are all optional; only the date pair has a (root) constraint.
  // pointOfContactId is intentionally NOT gated here (optional UUID).
  const STEP_FIELDS: Record<number, FieldPath<CreateProjectFormValues>[]> = {
    1: ['name', 'status', 'locations', 'assignedUserIds'],
    2: ['startDate', 'expectedEndDate'],
  };

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(3, s + 1));
  };

  const is409 =
    createMutation.isError &&
    isAxiosError(createMutation.error) &&
    createMutation.error.response?.status === 409;

  const stepHeading = t(`create.step${step}Heading`);
  const stepSubtext = t(`create.step${step}Subtext`);

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8">
      <Stepper
        step={step}
        labels={[t('create.steps.details'), t('create.steps.additional'), t('create.steps.review')]}
      />

      <div className="mt-6">
        <h2 className="text-xl font-bold text-foreground">{stepHeading}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{stepSubtext}</p>
      </div>

      {step === 1 && isProcurementOfficer && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('create.poBanner')}</span>
        </div>
      )}

      <form
        onSubmit={(e) => e.preventDefault()}
        className="mt-4"
        noValidate
      >
        {step === 1 && (
          <Step1
            form={form}
            t={t}
            deliveryIndexes={deliveryIndexes}
            storageIndexes={storageIndexes}
            watchedLocations={watchedLocations}
            setDefaultLocation={setDefaultLocation}
            handleAddressSearch={handleAddressSearch}
            append={append}
            remove={remove}
            locationFields={locationFields}
            assignableUsers={assignableUsers}
            selectedUsers={selectedUsers}
            assignedUserIds={assignedUserIds}
            toggleUser={toggleUser}
            isProcurementOfficer={isProcurementOfficer}
          />
        )}

        {step === 2 && (
          <Step2
            form={form}
            t={t}
            typeOptions={typeOptions}
            pointOfContactOptions={pointOfContactOptions}
            stagedFiles={stagedFiles}
            addFiles={addFiles}
            removeFile={removeFile}
          />
        )}

        {step === 3 && (
          <Step3
            form={form}
            t={t}
            selectedUsers={selectedUsers}
            stagedFiles={stagedFiles}
            removeFile={removeFile}
            addFiles={addFiles}
            onEditStep1={() => setStep(1)}
            onEditStep2={() => setStep(2)}
          />
        )}

        {createMutation.isError && (
          <Alert variant="destructive" className="mt-6">
            {is409 ? t('create.duplicateNameError') : t('create.createError')}
          </Alert>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="lg"
            leftIcon={<span className="text-base leading-none">✕</span>}
            onClick={() => navigate(ROUTES.projects)}
          >
            {t('create.cancel')}
          </Button>

          {step < 3 ? (
            <Button type="button" size="lg" onClick={() => void goNext()}>
              {t('create.continue')}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              isLoading={createMutation.isPending}
              onClick={() => void handleSubmit(onSubmit)()}
            >
              {createMutation.isPending ? t('create.creating') : t('create.createProject')}
            </Button>
          )}
        </div>

        {errors.assignedUserIds && step === 1 && (
          <p className="mt-2 text-xs text-destructive">{errors.assignedUserIds.message}</p>
        )}
      </form>
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

type AssignableUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  workStatus?: string | null;
};

function Step1({
  form,
  t,
  deliveryIndexes,
  storageIndexes,
  watchedLocations,
  setDefaultLocation,
  handleAddressSearch,
  append,
  remove,
  locationFields,
  assignableUsers,
  selectedUsers,
  assignedUserIds,
  toggleUser,
  isProcurementOfficer,
}: {
  form: UseFormReturn<CreateProjectFormValues>;
  t: TFn;
  deliveryIndexes: number[];
  storageIndexes: number[];
  watchedLocations: CreateProjectFormValues['locations'];
  setDefaultLocation: (index: number, type: LocationType) => void;
  handleAddressSearch: (input: string) => Promise<unknown>;
  append: ReturnType<typeof useFieldArray<CreateProjectFormValues, 'locations'>>['append'];
  remove: ReturnType<typeof useFieldArray<CreateProjectFormValues, 'locations'>>['remove'];
  locationFields: { id: string }[];
  assignableUsers: AssignableUser[];
  selectedUsers: AssignableUser[];
  assignedUserIds: string[];
  toggleUser: (userId: string) => void;
  isProcurementOfficer: boolean;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const status = watch('status');
  const [userSearch, setUserSearch] = useState('');

  const searchResults = userSearch.trim()
    ? assignableUsers.filter(
        (u) =>
          !assignedUserIds.includes(u.id) &&
          (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearch.toLowerCase())),
      )
    : [];

  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-6">
      <h3 className="text-base font-bold text-foreground">{t('create.projectDetails')}</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormField label={`${t('create.name')} *`} error={errors.name?.message}>
          <Input {...register('name')} placeholder={t('create.namePlaceholder')} />
        </FormField>

        <div>
          <p className="text-sm font-medium text-foreground mb-2">{t('create.status')} *</p>
          <div className="flex items-center gap-2">
            {STATUS_CHIPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue('status', s, { shouldValidate: true })}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  status === s
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-foreground hover:bg-muted/80',
                )}
              >
                {t(`create.statusChips.${s}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Project (delivery) locations */}
      <LocationGroup
        label={t('create.locations')}
        hint={t('create.markOneDefault')}
        addLabel={t('create.addLocation')}
        placeholder={t('create.addressPlaceholder')}
        indexes={deliveryIndexes}
        locationFields={locationFields}
        watchedLocations={watchedLocations}
        onSetDefault={(i) => setDefaultLocation(i, LocationType.DELIVERY)}
        onChangeAddress={(i, val) => setValue(`locations.${i}.address`, val, { shouldValidate: true })}
        onRemove={remove}
        onAdd={() =>
          append({ type: LocationType.DELIVERY, address: '', label: '', isDefault: false })
        }
        searchFn={handleAddressSearch}
        defaultLabel={t('create.default')}
        setDefaultLabel={t('create.setAsDefault')}
        removeLabel={t('create.removeLocation')}
      />
      {errors.locations && (
        <p className="text-xs text-destructive -mt-2">
          {errors.locations.message ?? errors.locations.root?.message}
        </p>
      )}

      {/* Storage locations */}
      <LocationGroup
        label={t('create.storageLocations')}
        hint={t('create.markOneDefault')}
        addLabel={t('create.addStorageLocation')}
        placeholder={t('create.storageAddressPlaceholder')}
        indexes={storageIndexes}
        locationFields={locationFields}
        watchedLocations={watchedLocations}
        onSetDefault={(i) => setDefaultLocation(i, LocationType.STORAGE)}
        onChangeAddress={(i, val) => setValue(`locations.${i}.address`, val, { shouldValidate: true })}
        onRemove={remove}
        onAdd={() =>
          append({ type: LocationType.STORAGE, address: '', label: '', isDefault: false })
        }
        searchFn={handleAddressSearch}
        defaultLabel={t('create.default')}
        setDefaultLabel={t('create.setAsDefault')}
        removeLabel={t('create.removeLocation')}
      />

      {/* Assigned users */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{t('create.assignedUsers')} *</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-2 py-1 text-sm text-foreground"
            >
              <AvatarWithStatus
                name={u.name}
                avatarUrl={u.avatarUrl}
                workStatus={u.workStatus as never}
                size={24}
              />
              {u.name}
              {!isProcurementOfficer && (
                <button
                  type="button"
                  aria-label={`remove-${u.name}`}
                  onClick={() => toggleUser(u.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        {!isProcurementOfficer && (
          <div className="relative">
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={t('create.searchUsers')}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      toggleUser(u.id);
                      setUserSearch('');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <AvatarWithStatus name={u.name} avatarUrl={u.avatarUrl} size={24} />
                    <span className="flex flex-col">
                      <span className="text-foreground">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LocationGroup({
  label,
  hint,
  addLabel,
  placeholder,
  indexes,
  locationFields,
  watchedLocations,
  onSetDefault,
  onChangeAddress,
  onRemove,
  onAdd,
  searchFn,
  defaultLabel,
  setDefaultLabel,
  removeLabel,
}: {
  label: string;
  hint: string;
  addLabel: string;
  placeholder: string;
  indexes: number[];
  locationFields: { id: string }[];
  watchedLocations: CreateProjectFormValues['locations'];
  onSetDefault: (index: number) => void;
  onChangeAddress: (index: number, val: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  searchFn: (input: string) => Promise<unknown>;
  defaultLabel: string;
  setDefaultLabel: string;
  removeLabel: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        {label} <span className="font-normal text-muted-foreground">* {hint}</span>
      </p>
      {indexes.map((index) => {
        const isDefault = watchedLocations[index]?.isDefault ?? false;
        return (
          <div key={locationFields[index].id} className="flex items-center gap-2">
            <div className="flex-1">
              <AddressInput
                value={watchedLocations[index]?.address ?? ''}
                placeholder={placeholder}
                searchFn={searchFn as never}
                onChange={(val) => onChangeAddress(index, val)}
              />
            </div>
            <button
              type="button"
              onClick={() => !isDefault && onSetDefault(index)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isDefault
                  ? 'bg-foreground text-background cursor-default'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {isDefault ? defaultLabel : setDefaultLabel}
            </button>
            {indexes.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={removeLabel}
                className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        size="md"
        leftIcon={<PlusIcon className="w-4 h-4" />}
        onClick={onAdd}
      >
        {addLabel}
      </Button>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({
  form,
  t,
  typeOptions,
  pointOfContactOptions,
  stagedFiles,
  addFiles,
  removeFile,
}: {
  form: UseFormReturn<CreateProjectFormValues>;
  t: TFn;
  typeOptions: { value: string; label: string }[];
  pointOfContactOptions: { value: string; label: string }[];
  stagedFiles: File[];
  addFiles: (files: FileList | File[]) => void;
  removeFile: (index: number) => void;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-6">
      <h3 className="text-base font-bold text-foreground">{t('create.projectDetails')}</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormField label={t('create.type')}>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                options={typeOptions}
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder={t('create.selectType')}
              />
            )}
          />
        </FormField>

        <FormField label={t('create.plannedBudgetAud')}>
          <Input
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            onKeyDown={onDecimalOnly}
            {...register('plannedBudget', { valueAsNumber: true })}
            placeholder={t('create.budgetPlaceholder')}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <FormField label={t('create.pointOfContact')}>
          <Controller
            name="pointOfContactId"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                options={pointOfContactOptions}
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder={t('create.selectUser')}
              />
            )}
          />
        </FormField>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {t('create.descriptionOptional')}{' '}
          <span className="font-normal text-muted-foreground">{t('create.optionalSuffix')}</span>
        </label>
        <Textarea
          {...register('description')}
          rows={4}
          placeholder={t('create.descriptionPlaceholder')}
        />
      </div>

      {/* Upload File — staged locally only */}
      <div className="rounded-lg border border-border p-4">
        <h4 className="text-base font-bold text-foreground mb-3">{t('create.uploadFile')}</h4>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            'w-full rounded-xl border border-dashed py-10 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border',
          )}
        >
          <p className="text-sm font-bold text-foreground">{t('create.dropzone')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('create.supportedFormats')}</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {stagedFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stagedFiles.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-sm text-foreground"
              >
                <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground" />
                {f.name}
                <button
                  type="button"
                  aria-label={`remove-file-${f.name}`}
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Step 3 (review) ─────────────────────────────────────────────────────────

function Step3({
  form,
  t,
  selectedUsers,
  stagedFiles,
  removeFile,
  addFiles,
  onEditStep1,
  onEditStep2,
}: {
  form: UseFormReturn<CreateProjectFormValues>;
  t: TFn;
  selectedUsers: AssignableUser[];
  stagedFiles: File[];
  removeFile: (index: number) => void;
  addFiles: (files: FileList | File[]) => void;
  onEditStep1: () => void;
  onEditStep2: () => void;
}) {
  const values = form.watch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deliveryLocations = (values.locations ?? []).filter(
    (l) => l.type === LocationType.DELIVERY && l.address,
  );
  const storageLocations = (values.locations ?? []).filter(
    (l) => l.type === LocationType.STORAGE && l.address,
  );

  const none = t('create.review.none');
  const fmtDate = (v?: string) => blankToUndefined(v) ?? none;

  return (
    <div className="space-y-6">
      {/* Card 1 */}
      <section className="bg-card rounded-lg border border-border p-6 relative">
        <button
          type="button"
          onClick={onEditStep1}
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
        >
          {t('create.editLink')}
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ReviewField label={t('create.review.name')} value={blankToUndefined(values.name) ?? none} />
          <ReviewField
            label={t('create.review.status')}
            value={
              <Badge>{t(`create.statusChips.${values.status ?? ProjectStatus.PLANNED}`)}</Badge>
            }
          />
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-2">{t('create.review.assignedUsers')}</p>
          <div className="flex flex-wrap items-center gap-4">
            {selectedUsers.length > 0
              ? selectedUsers.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <AvatarWithStatus name={u.name} avatarUrl={u.avatarUrl} size={24} />
                    {u.name}
                  </span>
                ))
              : none}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {t('create.review.projectLocations')}
            </p>
            <div className="space-y-1.5">
              {deliveryLocations.length > 0
                ? deliveryLocations.map((l, i) => (
                    <p key={i} className="flex items-center gap-2 text-sm text-foreground">
                      {l.address}
                      {l.isDefault && <FlagIcon className="w-3.5 h-3.5 text-muted-foreground" />}
                    </p>
                  ))
                : none}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {t('create.review.storageLocations')}
            </p>
            <div className="space-y-1.5">
              {storageLocations.length > 0
                ? storageLocations.map((l, i) => (
                    <p key={i} className="flex items-center gap-2 text-sm text-foreground">
                      {l.address}
                      {l.isDefault && <FlagIcon className="w-3.5 h-3.5 text-muted-foreground" />}
                    </p>
                  ))
                : none}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-1">{t('create.review.description')}</p>
          <p className="text-sm text-foreground">{blankToUndefined(values.description) ?? none}</p>
        </div>
      </section>

      {/* Card 2 */}
      <section className="bg-card rounded-lg border border-border p-6 relative">
        <button
          type="button"
          onClick={onEditStep2}
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
        >
          {t('create.editLink')}
        </button>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ReviewField
            label={t('create.review.type')}
            value={values.type ? <Badge>{values.type}</Badge> : none}
          />
          <ReviewField
            label={t('create.review.plannedBudget')}
            value={
              values.plannedBudget !== undefined &&
              values.plannedBudget !== null &&
              !Number.isNaN(values.plannedBudget)
                ? `${values.plannedBudget} ${values.currency ?? 'AUD'}`
                : none
            }
          />
          <ReviewField label={t('create.review.startDate')} value={fmtDate(values.startDate)} />
          <ReviewField label={t('create.review.endDate')} value={fmtDate(values.expectedEndDate)} />
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-2">{t('create.review.pointOfContact')}</p>
          {(() => {
            const poc = selectedUsers.find((u) => u.id === values.pointOfContactId);
            return poc ? (
              <span className="inline-flex items-center gap-2 text-sm text-foreground">
                <AvatarWithStatus name={poc.name} avatarUrl={poc.avatarUrl} size={24} />
                {poc.name}
              </span>
            ) : (
              <span className="text-sm text-foreground">{none}</span>
            );
          })()}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {stagedFiles.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-sm text-foreground"
            >
              <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground" />
              {f.name}
              <button
                type="button"
                aria-label={`remove-file-${f.name}`}
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="md"
            leftIcon={<PaperclipIcon className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('create.review.add')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </section>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

// Local Badge wrapper (neutral gray, matches Figma review pills).
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
