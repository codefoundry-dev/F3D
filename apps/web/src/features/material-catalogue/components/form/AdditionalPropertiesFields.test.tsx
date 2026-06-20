import { type MaterialFormValues } from '@forethread/shared-types/client';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { emptyMaterialForm } from '../../lib/materialForm';

import { AdditionalPropertiesFields } from './AdditionalPropertiesFields';

const CATEGORIES = [
  { id: 'cat-plumb', name: 'Plumbing & Drainage' },
  { id: 'cat-elec', name: 'Electrical' },
  { id: 'cat-adh', name: 'Adhesives & Sealants' },
  { id: 'cat-roof', name: 'Roofing' },
];

function Harness({
  categoryId,
  properties,
}: {
  categoryId: string;
  properties?: Record<string, string>;
}) {
  const methods = useForm<MaterialFormValues>({
    defaultValues: { ...emptyMaterialForm, categoryId, specificData: properties ?? {} },
  });
  return (
    <FormProvider {...methods}>
      <AdditionalPropertiesFields categories={CATEGORIES} />
    </FormProvider>
  );
}

describe('AdditionalPropertiesFields — category-driven Specific data', () => {
  it('renders the plumbing field set for a plumbing category', () => {
    render(<Harness categoryId="cat-plumb" />);

    expect(screen.getByText('Pressure rating (PN, PSI)')).toBeInTheDocument();
    expect(screen.getByText('Wall thickness / schedule')).toBeInTheDocument();
    expect(screen.getByText('Temperature resistance')).toBeInTheDocument();
    expect(screen.getByText('Connection type')).toBeInTheDocument();

    // The general structural attributes are NOT shown for plumbing.
    expect(screen.queryByText('Compressive strength')).not.toBeInTheDocument();
    expect(screen.queryByText('Tensile strength')).not.toBeInTheDocument();
  });

  it('renders a different field set for an electrical category', () => {
    render(<Harness categoryId="cat-elec" />);

    expect(screen.getByText('Electrical rating')).toBeInTheDocument();
    expect(screen.getByText('IP rating')).toBeInTheDocument();
    expect(screen.getByText('Insulation class')).toBeInTheDocument();
    expect(screen.getByText('Frequency')).toBeInTheDocument();

    expect(screen.queryByText('Connection type')).not.toBeInTheDocument();
    expect(screen.queryByText('Compressive strength')).not.toBeInTheDocument();
  });

  it('renders a Yes/No control for the adhesives "SDS required" field', () => {
    render(<Harness categoryId="cat-adh" />);

    expect(screen.getByText('Chemical type')).toBeInTheDocument();
    expect(screen.getByText('SDS required')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No' })).toBeInTheDocument();
  });

  it('falls back to the default structural set for an unmatched category', () => {
    render(<Harness categoryId="cat-roof" />);

    expect(screen.getByText('Compressive strength')).toBeInTheDocument();
    expect(screen.getByText('Density')).toBeInTheDocument();
    // Default field keeps the stable test id the create/edit flows rely on.
    expect(screen.getByTestId('material-form-compressive-strength')).toBeInTheDocument();
  });

  it('keeps the fixed Dimensions + Packaging sections regardless of category', () => {
    render(<Harness categoryId="cat-elec" />);

    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByTestId('material-form-dim-length')).toBeInTheDocument();
    expect(screen.getByTestId('material-form-units-per-package')).toBeInTheDocument();
  });
});
