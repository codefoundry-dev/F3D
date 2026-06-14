import {
  proposePoChange,
  listPoChangeRequests,
  type PoChangeRequest,
  type CreatePoChangeRequestInput,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { PoChangeDiff } from '@forethread/po-shared';
import {
  Modal,
  ModalIconHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Button,
  Spinner,
  Badge,
  formatDateTime,
  CHANGE_REQUEST_STATUS_COLORS,
} from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import EditWithoutLineIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface ChangeRequestModalProps {
  poId: string;
  onClose: () => void;
}

export function ChangeRequestModal({ poId, onClose }: ChangeRequestModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'new' | 'history'>('new');

  // Fetch existing change requests
  const { data: changeRequests, isLoading: isLoadingCrs } = useQuery({
    queryKey: ['po-change-requests', poId],
    queryFn: () => listPoChangeRequests(poId),
  });

  const proposeMutation = useMutation({
    mutationFn: (input: CreatePoChangeRequestInput) => proposePoChange(poId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['po-change-requests', poId] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', poId] });
      setMessage('');
      setTab('history');
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) return;
    proposeMutation.mutate({
      changeType: 'COMMERCIAL',
      changedFields: {},
      message: message.trim(),
    });
  };

  return (
    <Modal onClose={onClose} maxWidth="min-w-[640px] max-w-[640px]">
      <ModalBody>
        <ModalIconHeader
          icon={<EditWithoutLineIcon className="w-6 h-6 text-foreground" />}
          title={t('changeRequest.title', 'Change Request')}
          subtitle={t('changeRequest.subtitle', 'Request changes to this purchase order')}
          onClose={onClose}
          className="mb-6"
        />
        {/* Tab toggle */}
        <div className="flex gap-0 border-b border-border mb-4">
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`px-4 pb-2 pt-1 text-sm font-medium border-b-2 transition-colors ${
              tab === 'new'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('changeRequest.newTab', 'New Request')}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-4 pb-2 pt-1 text-sm font-medium border-b-2 transition-colors ${
              tab === 'history'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('changeRequest.historyTab', 'History')}
            {changeRequests && changeRequests.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {changeRequests.length}
              </span>
            )}
          </button>
        </div>

        {tab === 'new' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t(
                'changeRequest.description',
                'Describe the changes you would like to make to this purchase order. The contractor will review your request.',
              )}
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t(
                'changeRequest.messagePlaceholder',
                'Describe the changes you need...',
              )}
              rows={5}
            />
          </div>
        )}

        {tab === 'history' && (
          <div className="flex flex-col gap-3">
            {isLoadingCrs && (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            )}

            {!isLoadingCrs && (!changeRequests || changeRequests.length === 0) && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t('changeRequest.noHistory', 'No change requests yet')}
              </p>
            )}

            {changeRequests?.map((cr: PoChangeRequest) => (
              <ChangeRequestCard key={cr.id} cr={cr} />
            ))}
          </div>
        )}
      </ModalBody>

      {tab === 'new' && (
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={proposeMutation.isPending}>
            {t('changeRequest.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!message.trim()}
            isLoading={proposeMutation.isPending}
          >
            {t('changeRequest.submit', 'Submit Request')}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}

function ChangeRequestCard({ cr }: { cr: PoChangeRequest }) {
  const { t } = useTranslation('purchaseOrders');
  const colors = CHANGE_REQUEST_STATUS_COLORS[cr.status] ?? CHANGE_REQUEST_STATUS_COLORS.PENDING;

  const hasChanges =
    Object.keys(cr.changedFields?.fields ?? {}).length > 0 ||
    (cr.changedFields?.lineItems ?? []).length > 0;

  return (
    <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cr.reference && (
            <span className="text-sm font-bold text-foreground">{cr.reference}</span>
          )}
          <span className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
          <Badge className={`${colors.badge} text-xs`}>{cr.status}</Badge>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon className="w-3.5 h-3.5" />
          {formatDateTime(cr.createdAt)}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('changeRequest.requestedBy', { name: cr.requestedByName ?? '-' })}
      </p>

      {hasChanges && (
        <div className="mt-1">
          <PoChangeDiff changedFields={cr.changedFields} lineItemsAsCards />
        </div>
      )}

      {cr.message && <p className="text-sm text-foreground">{cr.message}</p>}

      {cr.status === 'REJECTED' && cr.reason && (
        <p className="text-sm text-destructive">
          {t('changeRequest.reason', { reason: cr.reason })}
        </p>
      )}

      {cr.resolvedByName && cr.resolvedAt && (
        <p className="text-xs text-muted-foreground">
          {t('changeRequest.resolvedBy', {
            name: cr.resolvedByName,
            date: formatDateTime(cr.resolvedAt),
          })}
        </p>
      )}
    </div>
  );
}
