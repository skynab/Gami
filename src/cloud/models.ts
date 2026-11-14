import { supabase } from '../auth/store';
import { fromFoldFile, toFoldFile, type FoldFile } from '../fold/fold-format';
import type { OrigamiModel } from '../fold/types';

/**
 * Models in the cloud (the `models` table): creators' saved drafts, and designs anyone signed in has submitted to
 * the gallery. Who can do what is enforced by the database's row-level security (supabase/migrations); these
 * functions just make the calls and say what went wrong.
 */

export type Status = 'draft' | 'submitted' | 'published' | 'rejected';

/** Whose design a submission is: the submitter's own, or traditional with no known designer. */
export type Ownership = 'own' | 'traditional';

/** What a submitter certifies about a design (docs/studio-plan.md, part 4). It's published under CC BY 4.0. */
export interface Submission {
  ownership: Ownership;
  /** How to credit it: the designer's name, or for a traditional design, who's sharing it. */
  credit: string;
  /** Where it was first published, if anywhere. */
  firstPublished: string;
}

/** The only licence the gallery takes for submissions. */
export const LICENCE = { id: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } as const;

export interface SavedModel {
  id: string;
  title: string;
  status: Status;
  reviewNote: string | null;
  shareToken: string | null;
  updatedAt: string;
  model: OrigamiModel;
  /** As submitted: null for a draft never submitted. */
  submission: (Submission & { licence: string }) | null;
}

interface Row {
  id: string;
  title: string;
  status: Status;
  review_note?: string | null;
  share_token?: string | null;
  updated_at?: string;
  fold: FoldFile;
  ownership?: Ownership | null;
  credit?: string | null;
  first_published?: string | null;
  licence?: string | null;
}

const fromRow = (r: Row): SavedModel => ({
  id: r.id,
  title: r.title,
  status: r.status,
  reviewNote: r.review_note ?? null,
  shareToken: r.share_token ?? null,
  updatedAt: r.updated_at ?? '',
  model: fromFoldFile(r.fold),
  submission: r.ownership && r.credit ? { ownership: r.ownership, credit: r.credit, firstPublished: r.first_published ?? '', licence: r.licence ?? LICENCE.id } : null,
});

class CloudError extends Error {}

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new CloudError(error.message);
  if (data === null) throw new CloudError('Not found, or you don’t have access to it.');
  return data;
}

const COLUMNS = 'id, title, status, review_note, share_token, updated_at, fold, ownership, credit, first_published, licence';

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

/**
 * Sends a design to the admins for the gallery, certifying whose it is, for anyone signed in: a new one, or (with
 * `id`) the person's own draft or sent-back model, replaced by `model`. The database records the certification
 * and the licence, and won't put a model into review any other way.
 */
export async function submitDesign(model: OrigamiModel, submission: Submission, id?: string): Promise<SavedModel> {
  const sb = await supabase();
  const submitted = check(
    await sb.rpc('submit_design', {
      model_id: id ?? null,
      title: model.title.trim() || 'Untitled model',
      fold: toFoldFile(model),
      ownership: submission.ownership,
      credit: submission.credit.trim(),
      first_published: submission.firstPublished.trim() || null,
    }),
  ) as string;
  return openModel(submitted);
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

/** Why someone reports a published model. */
export type ReportReason = 'notTheirs' | 'copyrighted' | 'inappropriate' | 'other';
export const REPORT_REASONS: ReportReason[] = ['notTheirs', 'copyrighted', 'inappropriate', 'other'];

/** Reports a published model to the admins, signed in or not. Only admins can read reports. */
export async function reportModel(id: string, reason: ReportReason, details: string, contact: string): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.from('model_reports').insert({ model: id, reason, details: details.trim(), contact: contact.trim() });
  if (error) throw new CloudError(error.message);
}

export interface Report {
  id: string;
  model: string;
  title: string;
  reason: ReportReason;
  details: string;
  contact: string;
  createdAt: string;
}

/** For admins: open reports, oldest first, each with its model's title. */
export async function openReports(): Promise<Report[]> {
  const sb = await supabase();
  const rows = check(await sb.from('model_reports').select('id, model, reason, details, contact, created_at').eq('status', 'open').order('created_at')) as {
    id: string;
    model: string;
    reason: ReportReason;
    details: string;
    contact: string;
    created_at: string;
  }[];
  const ids = [...new Set(rows.map((r) => r.model))];
  const titles = ids.length ? (check(await sb.from('models').select('id, title').in('id', ids)) as { id: string; title: string }[]) : [];
  const title = new Map(titles.map((m) => [m.id, m.title]));
  return rows.map((r) => ({ id: r.id, model: r.model, title: title.get(r.model) ?? '', reason: r.reason, details: r.details, contact: r.contact, createdAt: r.created_at }));
}

/** For admins: dismiss a report, or unpublish its model, sending it back to its owner with `note`. */
export async function decideReport(id: string, unpublish: boolean, note: string): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.rpc('decide_report', { report: id, unpublish, note: note.trim() });
  if (error) throw new CloudError(error.message);
}

/** For admins: publish a submitted model, or send it back with a note. */
export async function review(id: string, publish: boolean, note: string): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.from('models').update({ status: publish ? 'published' : 'rejected', review_note: note.trim() || null }).eq('id', id);
  if (error) throw new CloudError(error.message);
}

/** The link that opens a model from its share token. */
export const shareLink = (token: string) => `${location.origin}${import.meta.env.BASE_URL}s/${token}`;
