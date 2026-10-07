/** Données structurées. Les `<` sont échappés pour empêcher toute sortie de la balise <script>. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  // Bloc de données (type application/ld+json) : non exécutable, contenu entièrement sérialisé par JSON.stringify.
  // eslint-disable-next-line react/no-danger
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
