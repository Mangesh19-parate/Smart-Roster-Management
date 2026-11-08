/**
 * Unit tests for Enterprise Workforce UI components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { FilterToolbar } from '../components/FilterToolbar';
import { RosterSummary } from '../components/RosterSummary';
import { CellEditModal } from '../components/CellEditModal';

describe('Sidebar Component', () => {
  it('renders all management navigation options for MANAGER role', () => {
    const handleNav = vi.fn();
    render(
      <Sidebar
        activeNav="roster"
        onNavChange={handleNav}
        userRole="MANAGER"
        isCollapsed={false}
      />
    );

    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Roster')).toBeDefined();
    expect(screen.getByText('Employees')).toBeDefined();
    expect(screen.getByText('Brands & Processes')).toBeDefined();
    expect(screen.getByText('Pods')).toBeDefined();
    expect(screen.getByText('Leave Management')).toBeDefined();
    expect(screen.getByText('Working Rules')).toBeDefined();
    expect(screen.getByText('Reports')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('restricts management items for EMPLOYEE role', () => {
    const handleNav = vi.fn();
    render(
      <Sidebar
        activeNav="roster"
        onNavChange={handleNav}
        userRole="EMPLOYEE"
        isCollapsed={false}
      />
    );

    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Roster')).toBeDefined();
    expect(screen.getByText('Leave Management')).toBeDefined();

    // Restricted modules should not be in the document
    expect(screen.queryByText('Employees')).toBeNull();
    expect(screen.queryByText('Brands & Processes')).toBeNull();
    expect(screen.queryByText('Working Rules')).toBeNull();
  });
});

describe('FilterToolbar Component', () => {
  it('triggers search and view changes correctly', () => {
    const onSearchChange = vi.fn();
    const onViewChange = vi.fn();
    const onViewIdChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    const onJumpToday = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <FilterToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        view="company"
        onViewChange={onViewChange}
        viewId={null}
        onViewIdChange={onViewIdChange}
        statusFilter="ALL"
        onStatusFilterChange={onStatusFilterChange}
        pods={[{ id: 'p1', name: 'Alpha Pod' }]}
        brands={[]}
        processes={[]}
        employees={[]}
        onJumpToday={onJumpToday}
        onResetFilters={onResetFilters}
      />
    );

    // Test search input
    const searchInput = screen.getByPlaceholderText('Search employee or role...');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    expect(onSearchChange).toHaveBeenCalledWith('John');

    // Test view change
    const podTab = screen.getByText('By Pod');
    fireEvent.click(podTab);
    expect(onViewChange).toHaveBeenCalledWith('pod');
  });
});

describe('RosterSummary Component', () => {
  it('correctly calculates total employees and coverage gap counts', () => {
    const mockRoster = {
      month: '2026-12',
      employees: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
      entries: [
        { employee_id: '1', date: '2026-12-01', status: 'WORK' },
        { employee_id: '2', date: '2026-12-01', status: 'WO' },
      ],
      coverage: [
        { process_id: 'proc-1', date: '2026-12-01', required: 2, actual: 1, shortfall: 1 },
      ],
    };

    render(
      <RosterSummary
        rosterData={mockRoster}
        issues={[{ id: 'iss-1', severity: 'ERROR', rule: 'CoverageRule' }]}
        month="2026-12"
      />
    );

    expect(screen.getByText('Total Staff')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined(); // 2 total employees
    expect(screen.getByText('Coverage Gaps')).toBeDefined();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // working / coverage gaps
    expect(screen.getByText(/1 Crit/)).toBeDefined(); // 1 critical issue
  });
});

describe('CellEditModal Component', () => {
  it('allows changing status and toggling lock flag', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <CellEditModal
        isOpen={true}
        onClose={handleClose}
        employee={{ id: 'emp-1', name: 'Alice Johnson', pod: 'Alpha' }}
        date="2026-12-15"
        currentStatus="WORK"
        isLocked={false}
        issues={[]}
        onSave={handleSave}
      />
    );

    expect(screen.getByText('Alice Johnson')).toBeDefined();
    expect(screen.getByText('Pod: Alpha')).toBeDefined();

    // Change status to Weekly Off
    const select = screen.getByLabelText('Shift Status');
    fireEvent.change(select, { target: { value: 'WO' } });

    // Toggle lock checkbox
    const lockCheckbox = screen.getByLabelText(/Lock entry against regeneration/i);
    fireEvent.click(lockCheckbox);

    // Save
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(handleSave).toHaveBeenCalledWith({
      employee_id: 'emp-1',
      date: '2026-12-15',
      status: 'WO',
      locked: true,
      reason: undefined,
    });
  });
});
