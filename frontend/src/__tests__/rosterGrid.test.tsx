import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterGrid } from '../components/RosterGrid';

describe('RosterGrid', () => {
  const mockRosterData = {
    id: '11111111-1111-1111-1111-111111111111',
    month: '2026-12',
    status: 'DRAFT',
    entries: [
      {
        id: 'e1',
        employee_id: 'emp-1',
        employee: {
          id: 'emp-1',
          name: 'Amit Kumar',
          pod_id: 'pod-alpha',
          pod: { id: 'pod-alpha', name: 'Alpha' },
          role: 'AGENT',
        },
        date: '2026-12-01',
        status: 'WORK',
        locked: false,
      },
      {
        id: 'e2',
        employee_id: 'emp-2',
        employee: {
          id: 'emp-2',
          name: 'Neha Gupta',
          pod_id: 'pod-bravo',
          pod: { id: 'pod-bravo', name: 'Bravo' },
          role: 'AGENT',
        },
        date: '2026-12-01',
        status: 'WO',
        locked: false,
      },
    ],
    covers: [],
    employees: [
      {
        id: 'emp-1',
        name: 'Amit Kumar',
        pod_id: 'pod-alpha',
        pod: { id: 'pod-alpha', name: 'Alpha' },
        role: 'AGENT',
      },
      {
        id: 'emp-2',
        name: 'Neha Gupta',
        pod_id: 'pod-bravo',
        pod: { id: 'pod-bravo', name: 'Bravo' },
        role: 'AGENT',
      },
    ],
  };

  it('renders employee names correctly from metadata without falling back to Unknown', () => {
    render(
      <RosterGrid
        rosterData={mockRosterData}
        month="2026-12"
        view="company"
        viewId={null}
        issues={[]}
        selectedIssue={null}
        onCellEdit={() => {}}
        onIssueClick={() => {}}
      />
    );

    expect(screen.getByText('Amit Kumar')).toBeDefined();
    expect(screen.getByText('Neha Gupta')).toBeDefined();
    expect(screen.queryByText('Unknown')).toBeNull();
  });

  it('filters employees by pod_id correctly', () => {
    render(
      <RosterGrid
        rosterData={mockRosterData}
        month="2026-12"
        view="pod"
        viewId="pod-alpha"
        issues={[]}
        selectedIssue={null}
        onCellEdit={() => {}}
        onIssueClick={() => {}}
      />
    );

    expect(screen.getByText('Amit Kumar')).toBeDefined();
    expect(screen.queryByText('Neha Gupta')).toBeNull();
  });
});

