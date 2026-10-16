/**
 * Aplats v9 : chaque ton associe un fond et SA couleur de texte (contraste ≥ 4,5:1 garanti).
 * t1 bleu · t2 or (texte nuit) · t3 nuit · t4 sable · t5 blanc.
 */
export type Tone = 't1' | 't2' | 't3' | 't4' | 't5';

export const toneClasses: Record<Tone, string> = {
  t1: 'bg-c1 text-on-c1',
  t2: 'bg-c2 text-on-c2',
  t3: 'bg-c3 text-on-c3',
  t4: 'bg-c4 text-on-c4',
  t5: 'bg-white text-ink',
};

/** Ton suivant dans une séquence (mosaïques, bandes de catégorie). */
export function toneAt(sequence: readonly Tone[], index: number): Tone {
  return sequence[index % sequence.length] ?? 't5';
}
