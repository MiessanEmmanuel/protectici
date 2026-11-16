import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, Td, Th, THead, Tr } from '@/components/ui/Table';

describe('Table : pas de débordement de page (R10)', () => {
  it('la zone de défilement est positionnée pour contenir les éléments sr-only absolus', () => {
    render(
      <Table caption="Demandes">
        <THead>
          <Tr>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <tbody>
          <Tr>
            <Td>Ligne</Td>
          </Tr>
        </tbody>
      </Table>,
    );
    const region = screen.getByRole('region', { name: 'Demandes' });
    // jsdom ne calcule pas la mise en page : on vérifie le contrat (conteneur positionné + défilement interne).
    expect(region).toHaveClass('relative');
    expect(region).toHaveClass('scroll-x');
    expect(region).toHaveClass('max-w-full');
  });
});
