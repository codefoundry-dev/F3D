import {
  getProjects,
  addProjectMembers,
  removeProjectMember,
  type ProjectListItem,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { GridModal, Button, Checkbox, Spinner, Alert } from '@forethread/ui-components';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface ProjectAccessModalProps {
  userId: string;
  userName: string;
  currentProjectIds: string[];
  onClose: () => void;
}

export function ProjectAccessModal({
  userId,
  userName,
  currentProjectIds,
  onClose,
}: ProjectAccessModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentProjectIds));
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects-list-all'],
    queryFn: () => getProjects({ limit: 100 }),
  });

  useEffect(() => {
    setSelectedIds(new Set(currentProjectIds));
  }, [currentProjectIds]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentSet = new Set(currentProjectIds);
      const toAdd = [...selectedIds].filter((id) => !currentSet.has(id));
      const toRemove = currentProjectIds.filter((id) => !selectedIds.has(id));

      const promises: Promise<unknown>[] = [];

      // Add user to new projects
      for (const projectId of toAdd) {
        promises.push(addProjectMembers(projectId, { userIds: [userId] }));
      }

      // Remove user from unselected projects
      for (const projectId of toRemove) {
        promises.push(removeProjectMember(projectId, userId));
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          t('common:genericError'),
      );
    },
  });

  const toggle = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const hasChanges =
    selectedIds.size !== currentProjectIds.length ||
    [...selectedIds].some((id) => !currentProjectIds.includes(id));

  return (
    <GridModal
      onClose={onClose}
      icon={<ProjectsIcon className="size-6 text-gray-700" />}
      title={t('detail.projectAccess')}
      description={t('detail.projectAccessSubtitle', { name: userName })}
      actionsClassName="flex-row"
      actions={
        <>
          <Button variant="outline" type="button" onClick={onClose} className="flex-1">
            {t('common:cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
            disabled={!hasChanges}
            className="flex-1"
          >
            {saveMutation.isPending ? t('common:saving') : t('common:save')}
          </Button>
        </>
      }
    >
      <div className="w-full text-left">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="max-h-64 space-y-1 overflow-auto rounded-[12px] border border-gray-100 p-2">
            {data?.items.map((project: ProjectListItem) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-gray-25"
                onClick={() => toggle(project.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(project.id);
                  }
                }}
              >
                <Checkbox
                  checked={selectedIds.has(project.id)}
                  onChange={() => toggle(project.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
                  <p className="text-xs text-gray-500">{project.status}</p>
                </div>
              </div>
            ))}

            {data?.items.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-500">{t('detail.noProjects')}</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="w-full">
          {error}
        </Alert>
      )}
    </GridModal>
  );
}
