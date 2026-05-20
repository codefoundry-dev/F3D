import {
  getProjects,
  addProjectMembers,
  removeProjectMember,
  type ProjectListItem,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Button,
  Checkbox,
  Spinner,
  Alert,
} from '@forethread/ui-components';
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
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ProjectsIcon className="w-6 h-6 text-foreground" />
            </div>
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-foreground mt-4">
            {t('detail.projectAccess')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('detail.projectAccessSubtitle', { name: userName })}
          </p>

          <div className="w-full mt-4 text-left">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-auto rounded-lg border border-border p-2">
                {data?.items.map((project: ProjectListItem) => (
                  <div
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent cursor-pointer"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.status}</p>
                    </div>
                  </div>
                ))}

                {data?.items.length === 0 && (
                  <p className="text-sm text-muted-foreground px-3 py-2">
                    {t('detail.noProjects')}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-3 w-full">
              {error}
            </Alert>
          )}

          <div className="flex gap-3 w-full mt-6">
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
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
