import { cn } from '../ui/cn';

/**
 * SEUL point de l'application où `dangerouslySetInnerHTML` est autorisé.
 *
 * Il n'accepte que du HTML éditorial déjà assaini par l'API Laravel (liste blanche : p, h2–h4,
 * ul, ol, li, strong, em, a[href http/https/mailto, rel noopener nofollow ugc], blockquote, img
 * issues de la médiathèque ; jamais de script/style/iframe/on*). Ne l'utilisez jamais pour
 * une saisie utilisateur, un commentaire ou un champ non passé par l'assainissement serveur
 * (les commentaires sont affichés en texte brut).
 */
export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  // eslint-disable-next-line react/no-danger
  return <div className={cn('rich-text', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
