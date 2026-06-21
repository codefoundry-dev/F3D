import { useTranslation } from '@forethread/i18n';
import { materialFormSchema, type MaterialFormValues } from '@forethread/shared-types/client';
import { Button, buttonVariants, notificationService } from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { AdditionalPropertiesFields } from '../components/form/AdditionalPropertiesFields';
import { CoreIdentificationFields } from '../components/form/CoreIdentificationFields';
import { MaterialReviewSummary } from '../components/form/MaterialReviewSummary';
import { WizardStepper } from '../components/WizardStepper';
import { useCreateMaterial } from '../hooks/useMaterialFormMutations';
import { useMaterialCategories } from '../hooks/useMaterials';
import {
  ArrowCircleRightIcon,
  CheckCircleIcon,
  CubeIcon,
  FolderIcon,
  InfoIcon,
  PlusCircleIcon,
  SealCheckIcon,
} from '../icons/phosphor';
import { emptyMaterialForm, formToCreateInput } from '../lib/materialForm';

/** The step-1 fields that must validate before advancing past Core Identification. */
const STEP1_FIELDS = ['name', 'categoryId', 'uom', 'countryOfOrigin'] as const;

export default function CreateMaterialPage() {
  const { t } = useTranslation(['materialCatalogue']);
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { data: categories = [] } = useMaterialCategories();
  const createMutation = useCreateMaterial();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // CA / PO (non-approvers) contribute to the PRIVATE catalogue and land back on
  // the catalogue list; an approver (SA) goes straight to the new material.
  const isContributor = !has('material.approve');

  const methods = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: emptyMaterialForm,
    mode: 'onBlur',
  });

  const steps = [
    { label: t('create.steps.core'), icon: <InfoIcon className="size-[18px]" /> },
    { label: t('create.steps.details'), icon: <CubeIcon className="size-[18px]" /> },
    { label: t('create.steps.review'), icon: <SealCheckIcon className="size-[18px]" /> },
  ];

  const goToContinue = async () => {
    if (step === 1) {
      const valid = await methods.trigger([...STEP1_FIELDS]);
      if (!valid) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  };

  const handleCreate = (values: MaterialFormValues) => {
    createMutation.mutate(formToCreateInput(values), {
      onSuccess: (material) => {
        const detailPath = ROUTES.materialCatalogueDetail.replace(':id', material.id);
        notificationService.info(t('create.toastCreated', { name: material.name }), {
          icon: <CheckCircleIcon className="size-[18px]" />,
          action: { label: t('create.toastView'), onClick: () => navigate(detailPath) },
          duration: 6000,
        });
        navigate(isContributor ? ROUTES.materialCatalogue : detailPath);
      },
    });
  };

  return (
    <div className="p-8" data-testid="create-material-page">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <FolderIcon className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">{t('create.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.materialCatalogue}
            className={buttonVariants({ variant: 'outline' })}
            data-testid="create-material-cancel"
          >
            {t('form.cancel')}
          </Link>
          {step < 3 ? (
            <Button
              type="button"
              rightIcon={<ArrowCircleRightIcon className="size-[18px]" />}
              onClick={() => void goToContinue()}
              data-testid="create-material-continue"
            >
              {t('create.continue')}
            </Button>
          ) : (
            <Button
              type="button"
              rightIcon={<PlusCircleIcon className="size-[18px]" />}
              isLoading={createMutation.isPending}
              onClick={() => void methods.handleSubmit(handleCreate)()}
              data-testid="create-material-submit"
            >
              {createMutation.isPending ? t('create.submitting') : t('create.submit')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stepper ────────────────────────────────────────────────── */}
      <div className="mt-6">
        <WizardStepper
          steps={steps}
          current={step}
          onStepSelect={(n) => setStep(n as 1 | 2 | 3)}
          backLabel={t('create.backToStep')}
        />
      </div>

      <FormProvider {...methods}>
        <form
          // Creation is driven explicitly by the header "Add material" button
          // (onClick above), never by implicit form submission. Keeping the form
          // un-submittable removes the button-morph foot-gun entirely (see
          // [[wizard-button-morph-implicit-submit]]).
          onSubmit={(e) => e.preventDefault()}
          className="mt-6 space-y-6"
          noValidate
        >
          {step === 1 && <CoreIdentificationFields categories={categories} />}
          {step === 2 && <AdditionalPropertiesFields categories={categories} />}
          {step === 3 && (
            <MaterialReviewSummary
              values={methods.getValues()}
              categories={categories}
              onEditCore={() => setStep(1)}
              onEditAdditional={() => setStep(2)}
            />
          )}
        </form>
      </FormProvider>
    </div>
  );
}
