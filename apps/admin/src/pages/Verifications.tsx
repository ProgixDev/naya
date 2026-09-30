import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { User, VerificationCase } from '@naya/domain';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/context';
import { fmtDateTime } from '../lib/format';
import { Card, DataTable, EmptyState, ErrorState, PageHeader, Pagination, Select, TableSkeleton } from '../components/ui';
import { SUBJECT_LABELS, VerificationBadge } from '../components/status';

type Row = { case: VerificationCase; user: User };

/** A04 · File de vérification. */
export function VerificationsPage() {
  const { cityId } = useWorkspace();
  const navigate = useNavigate();
  const [status, setStatus] = useState('queue');
  const [subject, setSubject] = useState('');
  const [cursor, setCursor] = useState(0);
  const q = useQuery({ queryKey: ['admin', 'verifications', cityId, status, subject, cursor], queryFn: () => api.admin.verifications({ status: status === 'all' ? undefined : status, subject: subject || undefined, cityId, cursor }), refetchInterval: 15_000 });
  return (
    <>
      <PageHeader title="Vérifications" subtitle="Examen manuel des identités et des véhicules. Une soumission n’est jamais une approbation." />
      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 px-5 pt-5">
          <label className="flex flex-col gap-1">
            <span className="label">Statut</span>
            <Select value={status} onChange={(e) => (setStatus(e.target.value), setCursor(0))} className="w-56" data-testid="filter-status">
              <option value="queue">À examiner</option>
              <option value="more_info_requested">Complément demandé</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Refusés</option>
              <option value="all">Tous</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Type de dossier</span>
            <Select value={subject} onChange={(e) => (setSubject(e.target.value), setCursor(0))} className="w-56" data-testid="filter-subject">
              <option value="">Tous les types</option>
              <option value="passenger_identity">Identité passagère</option>
              <option value="driver_identity">Identité chauffeuse</option>
              <option value="vehicle">Véhicule</option>
            </Select>
          </label>
        </div>
        <div className="mt-4">
          {q.isLoading ? <TableSkeleton cols={5} /> : null}
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
          {q.data ? (
            <>
              <DataTable<Row>
                caption="Dossiers de vérification"
                rows={q.data.items}
                rowKey={(r) => r.case.id}
                onRowClick={(r) => navigate(`/verifications/${r.case.id}`)}
                empty={<EmptyState title="Aucun dossier" message={status === 'queue' ? 'Tous les dossiers envoyés ont été examinés.' : 'Aucun dossier ne correspond à ces filtres.'} />}
                initialSort={{ key: 'sent', dir: 'asc' }}
                columns={[
                  { key: 'id', header: 'Dossier', render: (r) => <span className="font-semibold">{r.case.id}</span>, sort: (r) => r.case.id },
                  { key: 'who', header: 'Personne', render: (r) => `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.phone, sort: (r) => r.user.lastName },
                  { key: 'type', header: 'Type', render: (r) => SUBJECT_LABELS[r.case.subject] },
                  { key: 'sent', header: 'Envoyé le', render: (r) => fmtDateTime(r.case.submittedAt), sort: (r) => r.case.submittedAt ?? '' },
                  { key: 'st', header: 'Statut', render: (r) => <VerificationBadge status={r.case.status} /> },
                ]}
              />
              <Pagination cursor={cursor} total={q.data.total} limit={20} onChange={setCursor} />
            </>
          ) : null}
        </div>
      </Card>
    </>
  );
}
