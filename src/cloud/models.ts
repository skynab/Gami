import { supabase } from '../auth/store';
import { fromFoldFile, toFoldFile, type FoldFile } from '../fold/fold-format';
import type { OrigamiModel } from '../fold/types';

/**
 * Models saved in the cloud by creators (the `models` table). Who can do what is enforced by the database's
 * row-level security (supabase/migrations); these functions just make the calls and say what went wrong.
 */

export type Status = 'draft' | 'submitted' | 'published' | 'rejected';

export interface SavedModel {
  id: string;
  title: string;
  status: Status;
  reviewNote: string | null;
  shareToken: string | null;
  updatedAt: string;
  model: OrigamiModel;
}

interface Row {
  id: string;
  title: string;
  status: Status;
  review_note?: string | null;
  share_token?: string | null;
  updated_at?: string;
  fold: FoldFile;
}

const fromRow = (r: Row): SavedModel => ({
  id: r.id,
  title: r.title,
  status: r.status,
  reviewNote: r.review_note ?? null,
  shareToken: r.share_token ?? null,
  updatedAt: r.updated_at ?? '',
  model: fromFoldFile(r.fold),
});

class CloudError extends Error {}

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new CloudError(error.message);
  if (data === null) throw new CloudError('Not found, or you don’t have access to it.');
  return data;
}

const COLUMNS = 'id, title, status, review_note, share_token, updated_at, fold';

/** The signed-in creator's own models, newest first. */
export async function myModels(userId: string): Promise<SavedModel[]> {
  const sb = await supabase();
  return check(await sb.from('models').select(COLUMNS).eq('owner', userId).order('updated_at', { ascending: false })).map(fromRow);
}

/**
 * Saves a model: a new draft without `id`, or updates an existing one. Editing a rejected model puts it back
 * to draft. Models in review or published can't be edited (the database refuses); save a copy instead.
 */
export async function saveModel(model: OrigamiModel, id?: string): Promise<SavedModel> {
  const sb = await supabase();
  const row = { title: model.title.trim() || 'Untitled model', fold: toFoldFile(model) };
  const query = id ? sb.from('models').update({ ...row, status: 'draft' }).eq('id', id) : sb.from('models').insert(row);
  return fromRow(check(await query.select(COLUMNS).single()));
}

/** Sends a draft to the admins for the public gallery. */
export async function submitModel(id: string): Promise<SavedModel> {
  const sb = await supabase();
  return fromRow(check(await sb.from('models').update({ status: 'submitted' }).eq('id', id).select(COLUMNS).single()));
}

export async function deleteModel(id: string): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.from('models').delete().eq('id', id);
  if (error) throw new CloudError(error.message);
}

/** A published model, or one of the signed-in person's own. */
export async function openModel(id: string): Promise<SavedModel> {
  const sb = await supabase();
  return fromRow(check(await sb.from('models').select(COLUMNS).eq('id', id).maybeSingle()));
}

/** A model opened from its private share link. */
export async function openShared(token: string): Promise<SavedModel> {
  const sb = await supabase();
  const rows = check(await sb.rpc('shared_model', { token }));
  if (!Array.isArray(rows) || !rows.length) throw new CloudError('This link doesn’t open a model. It may have been deleted.');
  return fromRow(rows[0] as Row);
}

/** Published community models for the gallery, newest first. */
export async function publishedModels(limit = 24): Promise<SavedModel[]> {
  const sb = await supabase();
  return check(await sb.from('models').select('id, title, status, updated_at, fold').eq('status', 'published').order('updated_at', { ascending: false }).limit(limit)).map(fromRow);
}

/** For admins: models waiting for review, oldest first. */
export async function modelsToReview(): Promise<SavedModel[]> {
  const sb = await supabase();
  return check(await sb.from('models').select(COLUMNS).eq('status', 'submitted').order('updated_at')).map(fromRow);
}

/** For admins: publish a submitted model, or send it back with a note. */
export async function review(id: string, publish: boolean, note: string): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.from('models').update({ status: publish ? 'published' : 'rejected', review_note: note.trim() || null }).eq('id', id);
  if (error) throw new CloudError(error.message);
}

/** The link that opens a model from its share token. */
export const shareLink = (token: string) => `${location.origin}${import.meta.env.BASE_URL}s/${token}`;
