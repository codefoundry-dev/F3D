import type { ProjectListItem } from '@forethread/api-client';
import { CustomDropdown, FormField } from '@forethread/ui-components';

interface StepProjectProps {
  projects: ProjectListItem[];
  value: string;
  onChange: (projectId: string) => void;
  error?: string;
  isLoading?: boolean;
}

export function StepProject({ projects, value, onChange, error, isLoading }: StepProjectProps) {
  const options = projects.map((p) => ({ value: p.id, label: p.name }));

  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the project this request for quote belongs to.
        </p>
      </div>

      <FormField label="Project" error={error}>
        <CustomDropdown
          options={options}
          value={value}
          onChange={onChange}
          searchable
          placeholder={isLoading ? 'Loading projects…' : 'Select a project'}
        />
      </FormField>
    </section>
  );
}
