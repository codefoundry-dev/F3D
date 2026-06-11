import {
  createBom,
  getBom,
  getBoms,
  queryKeys,
  type BomDetailDto,
  type BomListItemDto,
  type CreateBomInput,
} from '@forethread/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useProjectBoms(projectId: string) {
  return useQuery<BomListItemDto[]>({
    queryKey: queryKeys.boms.byProject(projectId),
    queryFn: () => getBoms(projectId),
    enabled: Boolean(projectId),
  });
}

export function useBom(id: string | null) {
  return useQuery<BomDetailDto>({
    queryKey: queryKeys.boms.detail(id ?? ''),
    queryFn: () => getBom(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBomInput) => createBom(input),
    onSuccess: (bom) => {
      qc.setQueryData(queryKeys.boms.detail(bom.id), bom);
      void qc.invalidateQueries({ queryKey: queryKeys.boms.all() });
    },
  });
}
