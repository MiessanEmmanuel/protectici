import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '@/components/admin/content/RichTextEditor';

describe('RichTextEditor : contenu initial (R04)', () => {
  it('le HTML initial est rendu et ré-enregistré sans échappement', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        label="Corps de l’article"
        value="<h2>Titre</h2><p>Un <strong>paragraphe</strong>.</p>"
        onChange={onChange}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'Corps de l’article' });
    // Rendu comme du HTML, pas comme du texte contenant des balises.
    expect(box.querySelector('h2')?.textContent).toBe('Titre');
    expect(box.querySelector('strong')?.textContent).toBe('paragraphe');
    expect(box.textContent).not.toContain('<h2>');
    fireEvent.input(box);
    const saved = onChange.mock.calls.at(-1)![0] as string;
    expect(saved).toContain('<h2>Titre</h2>');
    expect(saved).not.toContain('&lt;');
  });

  it('le contenu initial reste filtré par la liste blanche', () => {
    render(
      <RichTextEditor
        label="Corps"
        value={'<p onclick="alert(1)">Texte</p><script>alert(1)</script><img src="x" onerror="alert(1)">'}
        onChange={() => {}}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'Corps' });
    expect(box.querySelector('script, img, [onclick]')).toBeNull();
    expect(box.textContent).toContain('Texte');
  });
});
