import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { accountsEnabled } from '../auth/store';
import { openModel, openShared, type Status } from '../cloud/models';
import { ModelViewer } from '../viewer/ModelViewer';
import { NotFound } from './NotFound';

/** Studio models that aren't in the gallery say so above the steps. */
const NOTICE: Partial<Record<Status, true>> = { draft: true, submitted: true, rejected: true };

/** A model made in the Studio: `/m/:id` for published ones (or your own), `/s/:token` from a private link. */
export function CommunityModel({ shared = false }: { shared?: boolean }) {
  const { t } = useTranslation();
  const { id = '', token = '' } = useParams();
  const [status, setStatus] = useState<Status | null>(null);
  if (!accountsEnabled) return <NotFound />;
  const key = shared ? `shared-${token}` : `community-${id}`;
  const load = () =>
    (shared ? openShared(token) : openModel(id)).then((saved) => {
      setStatus(saved.status);
      return saved.model;
    });
  return <ModelViewer key={key} progressKey={key} title="" load={load} notice={status && NOTICE[status] && t(`notice.${status}`)} />;
}
