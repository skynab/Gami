import { useState } from 'react';
import { useParams } from 'react-router';
import { accountsEnabled } from '../auth/store';
import { openModel, openShared, type Status } from '../cloud/models';
import { ModelViewer } from '../viewer/ModelViewer';
import { NotFound } from './NotFound';

const NOTICE: Partial<Record<Status, string>> = {
  draft: 'Draft · not in the gallery',
  submitted: 'Waiting for review · not in the gallery yet',
  rejected: 'Sent back for changes · not in the gallery',
};

/** A model made in the Studio: `/m/:id` for published ones (or your own), `/s/:token` from a private link. */
export function CommunityModel({ shared = false }: { shared?: boolean }) {
  const { id = '', token = '' } = useParams();
  const [status, setStatus] = useState<Status | null>(null);
  if (!accountsEnabled) return <NotFound />;
  const key = shared ? `shared-${token}` : `community-${id}`;
  const load = () =>
    (shared ? openShared(token) : openModel(id)).then((saved) => {
      setStatus(saved.status);
      return saved.model;
    });
  return <ModelViewer key={key} progressKey={key} title="" load={load} notice={status && NOTICE[status]} />;
}
