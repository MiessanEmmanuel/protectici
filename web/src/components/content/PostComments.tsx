'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { BlogComment } from '@/lib/api/types';
import { COMMENT_MAX, commentSchema } from '@/lib/content-schemas';
import { formatDate } from '@/lib/format';
import { buildHref } from '@/lib/search-params';
import { useResource } from '@/lib/use-async';
import { formToObject, validate } from '@/lib/validation';
import { useSession } from '../layout/SessionProvider';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { Button, ButtonLink } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { Textarea } from '../ui/Textarea';

/**
 * Commentaires d'un article : lecture publique (texte brut, jamais de HTML), formulaire réservé aux
 * comptes connectés dont l'e-mail est vérifié. Les commentaires sont modérés avant publication.
 */
export function PostComments({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const list = useResource(() => clientApi.listPostComments(slug, page), [slug, page]);
  return (
    <section aria-labelledby="commentaires" className="flex flex-col gap-4">
      <h2 id="commentaires" className="text-2xl font-bold">
        Commentaires
      </h2>
      <QueryBoundary state={list} loadingLabel="Chargement des commentaires…">
        {(res) => (
          <>
            {res.data.length === 0 ? (
              <p className="text-muted">
                Aucun commentaire pour le moment. Soyez le premier à réagir.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {res.data.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
              </ul>
            )}
            <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
          </>
        )}
      </QueryBoundary>
      <CommentForm slug={slug} />
    </section>
  );
}

function CommentItem({ comment }: { comment: BlogComment }) {
  return (
    <li className="border-2 border-ink bg-white p-4">
      <p className="text-sm text-muted">
        <strong className="text-ink">{comment.author_name}</strong> ·{' '}
        <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>
      </p>
      <p className="mt-1 break-words whitespace-pre-line">{comment.body}</p>
      {comment.replies.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3 border-l-2 border-primary-soft-2 pl-4">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <p className="text-sm text-muted">
                <strong className="text-ink">{r.author_name}</strong> ·{' '}
                <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
              </p>
              <p className="mt-1 break-words whitespace-pre-line">{r.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CommentForm({ slug }: { slug: string }) {
  const { user, status } = useSession();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const spam = useAntiSpam();

  if (status === 'loading') return null;
  if (status !== 'authenticated' || !user) {
    return (
      <div className="border-2 border-ink bg-c4 p-4">
        <p>
          Connectez-vous pour laisser un commentaire. Les commentaires sont publiés après
          modération.
        </p>
        <div className="mt-3">
          <ButtonLink
            href={buildHref('/connexion', { redirect: `/blog/${slug}` })}
            variant="secondary"
          >
            Se connecter
          </ButtonLink>{' '}
          <Link href="/inscription" className="ml-2">
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }
  if (!user.email_verified) {
    return (
      <p role="status" className="border-2 border-ink bg-c4 p-4">
        Vérifiez votre adresse e-mail (lien reçu à l’inscription) pour pouvoir commenter.
      </p>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    setFormError(null);
    const parsed = validate(commentSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setError(parsed.errors.body);
    setError(undefined);
    if (!spam.ready) return setFormError(TURNSTILE_REQUIRED_MESSAGE);
    running.current = true;
    setBusy(true);
    try {
      await clientApi.createPostComment(slug, { body: parsed.data.body, ...spam.payload() });
      setSent(true);
      setBody('');
    } catch (err) {
      const d = describeError(err);
      setError(d.fields.body);
      setFormError(d.form);
    } finally {
      spam.reset();
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      className="flex flex-col gap-3"
    >
      <h3 className="text-xl heading-block">Laisser un commentaire</h3>
      {sent ? (
        <FormSuccess message="Merci ! Votre commentaire a bien été reçu : il sera publié après modération." />
      ) : null}
      <FormError message={formError} />
      <Textarea
        label="Votre commentaire"
        name="body"
        rows={4}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSent(false);
        }}
        hint={`Entre 2 et ${COMMENT_MAX} caractères. ${body.length} / ${COMMENT_MAX}`}
        error={error}
        required
      />
      <AntiSpamFields spam={spam} />
      <div>
        <Button type="submit" loading={busy}>
          Publier le commentaire
        </Button>
      </div>
    </form>
  );
}
