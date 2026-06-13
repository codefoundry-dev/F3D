import { useTranslation } from '@forethread/i18n';
import { Stepper } from '@forethread/po-shared';
import { materialFormSchema, type MaterialFormValues } from '@forethread/shared-types/client';
import { Button, buttonVariants } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { AdditionalPropertiesFields } from '../components/form/AdditionalPropertiesFields';
import { CoreIdentificationFields } from '../components/form/CoreIdentificationFields';
import { MaterialReviewSummary } from '../components/form/MaterialReviewSummary';
import { MaterialCatalogueSuccessModal } from '../components/MaterialCatalogueSuccessModal';
import { useCreateMaterial } from '../hooks/useMaterialFormMutations';
import { useMaterialCategories } from '../hooks/useMaterials';
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
  // CA / PO (non-approvers) contribute to the PRIVATE catalogue: show the
  // "submitted for approval" success modal then redirect to the catalogue.
  const isContributor = !has('material.approve');
  const [showSuccess, setShowSuccess] = useState(false);

  const methods = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: emptyMaterialForm,
    mode: 'onBlur',
  });

  const stepLabels = [
    t('create.stepper.core'),
    t('create.stepper.details'),
    t('create.stepper.review'),
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
        if (isContributor) {
          // Stay on the page behind the success modal; it redirects to the
          // catalogue after the countdown (US 4.02).
          setShowSuccess(true);
        } else {
          navigate(ROUTES.materialCatalogueDetail.replace(':id', material.id));
        }
      },
    });
  };

  const heading =
    step === 1
      ? t('create.step1.heading')
      : step === 2
        ? t('create.step2.heading')
        : t('create.step3.heading');

  return (
    <div className="p-8" data-testid="create-material-page">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.materialCatalogue)}
          className="mt-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label={t('create.back')}
          data-testid="create-material-back"
        >
          <BackArrowIcon className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-semibold text-foreground">{t('create.title')}</h1>
      </div>

      {/* ── Stepper ────────────────────────────────────────────────── */}
      <div className="mt-6">
        <Stepper step={step} labels={stepLabels} />
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        {step === 3 && (
          <p className="text-sm text-muted-foreground">{t('create.step3.subtitle')}</p>
        )}
      </div>

      <FormProvider {...methods}>
        <form
          // Creation is driven explicitly by the step-3 "Add material" button
          // (onClick below), never by implicit form submission. A "Continue"
          // click must advance the step, not submit — and because React reuses
          // and synchronously re-types the shared footer <button> node during
          // the click, a real submit button there would morph button→submit
          // mid-click and fire an unwanted create. Keeping the form un-submittable
          // removes that foot-gun entirely.
          onSubmit={(e) => e.preventDefault()}
          className="mt-6 space-y-6"
          noValidate
        >
          {step === 1 && <CoreIdentificationFields categories={categories} />}
          {step === 2 && <AdditionalPropertiesFields />}
          {step === 3 && (
            <MaterialReviewSummary
              values={methods.getValues()}
              categories={categories}
              onEditCore={() => setStep(1)}
              onEditAdditional={() => setStep(2)}
            />
          )}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2">
            <Link
              to={ROUTES.materialCatalogue}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
              data-testid="create-material-cancel"
            >
              {t('form.cancel')}
            </Link>

            {step < 3 ? (
              <Button
                type="button"
                size="lg"
                onClick={() => void goToContinue()}
                data-testid="create-material-continue"
              >
                {t('create.continue')}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                isLoading={createMutation.isPending}
                onClick={() => void methods.handleSubmit(handleCreate)()}
                data-testid="create-material-submit"
              >
                {createMutation.isPending ? t('create.submitting') : t('create.submit')}
              </Button>
            )}
          </div>
        </form>
      </FormProvider>

      {showSuccess && (
        <MaterialCatalogueSuccessModal
          variant="contribute"
          onClose={() => navigate(ROUTES.materialCatalogue)}
        />
      )}
    </div>
  );
}
