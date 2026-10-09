import type { MyEstablishment, ReferenceData } from '@/lib/api/types';

export interface TabProps {
  est: MyEstablishment;
  reference: ReferenceData;
  /** Fiche suspendue : tout est en lecture seule. */
  readOnly: boolean;
  /** Remplace la fiche affichée par la réponse du serveur. */
  onSaved: (est: MyEstablishment) => void;
  /** Recharge la fiche depuis l'API (après un envoi de fichier, une demande, etc.). */
  reload: () => void;
}
