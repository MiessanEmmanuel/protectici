/** Contrôles de fichiers côté client : UX uniquement, le serveur vérifie le type réel (security.md §16). */

export interface FileRules {
  types: string[];
  maxBytes: number;
  /** Libellé lisible des formats, ex. « PDF, JPEG ou PNG ». */
  typesLabel: string;
}

export const DOCUMENT_RULES: FileRules = {
  types: ['application/pdf', 'image/jpeg', 'image/png'],
  maxBytes: 10 * 1024 * 1024,
  typesLabel: 'PDF, JPEG ou PNG',
};

export const IMAGE_RULES: FileRules = {
  types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  maxBytes: 5 * 1024 * 1024,
  typesLabel: 'JPEG, PNG, WebP ou AVIF',
};

export const MAX_DOCUMENTS = 5;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

/** Renvoie un message d'erreur en français, ou null si le fichier est acceptable. */
export function checkFile(file: File, rules: FileRules): string | null {
  if (!rules.types.includes(file.type)) {
    return `Format non accepté. Formats autorisés : ${rules.typesLabel}.`;
  }
  if (file.size > rules.maxBytes) {
    return `Fichier trop volumineux (maximum ${formatBytes(rules.maxBytes)}).`;
  }
  if (file.size === 0) return 'Le fichier est vide.';
  return null;
}
