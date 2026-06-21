import { useTranslation } from '@forethread/i18n';
import { materialFormSchema, type MaterialFormValues } from '@forethread/shared-types/client';
import { Button, buttonVariants } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { AdditionalPropertiesFields } from '../components/form/AdditionalPropertiesFields';
import { MaterialCatalogueSuccessModal } from '../components/MaterialCatalogueSuccessModal';
import { useMaterial } from '../hooks/useMaterial';
import { useUpdateMaterial } from '../hooks/useMaterialFormMutations';
import { CheckCircleIcon } from '../icons/phosphor';
import { detailToForm, emptyMaterialForm, formToUpdateAdditional } from '../lib/materialForm';

export default function EditMaterialAdditionalPage() {
  const { t } = useTranslation(['materialCatalogue']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { data: material, isLoading, isError } = useMaterial(id);
  const [showChangeSubmitted, setShowChangeSubmitted] = useState(false);
  const updateMutation = useUpdateMaterial({
    successMessageKey: 'editAdditional.toastSuccess',
    errorMessageKey: 'editAdditional.toastError',
  });

  const methods = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: emptyMaterialForm,
    mode: 'onBlur',
  });

  const { reset } = methods;
  useEffect(() => {
    if (material) reset(detailToForm(material));
  }, [material, reset]);

  const detailPath = id
    ? ROUTES.materialCatalogueDetail.replace(':id', id)
    : ROUTES.materialCatalogue;

  // A CA / PO editing a PUBLIC material creates a change request (not a direct
  // edit), so we show the "Changes submitted for review" modal + redirect.
  const isChangeRequest = !has('material.approve') && material?.status === 'PUBLIC';

  const onSubmit = (values: MaterialFormValues) => {
    if (!id) return;
    updateMutation.mutate(
      { id, input: formToUpdateAdditional(values) },
      {
        onSuccess: () => {
          if (isChangeRequest) setShowChangeSubmitted(true);
          else navigate(detailPath);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p role="status" className="text-muted-foreground">
          {t('editAdditional.loading')}
        </p>
      </div>
    );
  }

  if (isError || !material) {
    return (
      <div className="p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.materialCatalogue)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackArrowIcon className="w-4 h-4" />
          {t('editAdditional.back')}
        </button>
        <p role="alert" className="text-destructive">
          {t('editAdditional.notFound')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="edit-material-additional-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(detailPath)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t('editAdditional.back')}
            data-testid="edit-material-additional-back"
          >
            <BackArrowIcon className="h-4 w-4" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground">{t('editAdditional.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={detailPath}
            className={buttonVariants({ variant: 'outline' })}
            data-testid="edit-material-additional-cancel"
          >
            {t('form.cancel')}
          </Link>
          <Button
            type="button"
            rightIcon={<CheckCircleIcon className="size-[18px]" />}
            isLoading={updateMutation.isPending}
            onClick={() => void methods.handleSubmit(onSubmit)()}
            data-testid="edit-material-additional-submit"
          >
            {updateMutation.isPending ? t('editAdditional.submitting') : t('editAdditional.submit')}
          </Button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-6" noValidate>
          <AdditionalPropertiesFields
            categories={
              material.categoryName
                ? [{ id: material.categoryId, name: material.categoryName }]
                : []
            }
          />
        </form>
      </FormProvider>

      {showChangeSubmitted && (
        <MaterialCatalogueSuccessModal
          variant="changeSubmitted"
          onClose={() => navigate(ROUTES.materialCatalogue)}
        />
      )}
    </div>
  );
}
