/**
 * Realistic Demo Data Generator for Local Testing & Sandbox Exploration.
 * Mirrors the canonical backend seed specification (5 pods, 37 employees, 23 brands).
 */

export interface DemoPod {
  id: string;
  name: string;
  lead_employee_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DemoEmployee {
  id: string;
  name: string;
  pod_id: string;
  pod: { id: string; name: string };
  role: 'LEAD' | 'AGENT' | 'FLOATER';
  preferred_off_days: number[];
  max_consecutive_days: number;
  max_cover_per_day: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const DEMO_PODS: DemoPod[] = [
  { id: 'pod-alpha', name: 'Alpha', lead_employee_id: 'emp-patel', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'pod-bravo', name: 'Bravo', lead_employee_id: 'emp-singh', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'pod-charlie', name: 'Charlie', lead_employee_id: 'emp-khan', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'pod-delta', name: 'Delta', lead_employee_id: 'emp-reddy', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'pod-echo', name: 'Echo', lead_employee_id: 'emp-sharma', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

const RAW_EMPLOYEES: Array<{ id: string; name: string; pod: string; role: 'LEAD' | 'AGENT' | 'FLOATER'; pref: number[] }> = [
  // Leads (5)
  { id: 'emp-patel', name: 'Meera Patel', pod: 'Alpha', role: 'LEAD', pref: [5, 6] },
  { id: 'emp-singh', name: 'Rohan Singh', pod: 'Bravo', role: 'LEAD', pref: [5, 6] },
  { id: 'emp-khan', name: 'Sana Khan', pod: 'Charlie', role: 'LEAD', pref: [5, 6] },
  { id: 'emp-reddy', name: 'Arjun Reddy', pod: 'Delta', role: 'LEAD', pref: [5, 6] },
  { id: 'emp-sharma', name: 'Priya Sharma', pod: 'Echo', role: 'LEAD', pref: [5, 6] },
  // Alpha (6)
  { id: 'emp-amit', name: 'Amit Kumar', pod: 'Alpha', role: 'AGENT', pref: [6] },
  { id: 'emp-neha', name: 'Neha Gupta', pod: 'Alpha', role: 'AGENT', pref: [5] },
  { id: 'emp-vikram', name: 'Vikram Joshi', pod: 'Alpha', role: 'AGENT', pref: [6] },
  { id: 'emp-kavya', name: 'Kavya Iyer', pod: 'Alpha', role: 'AGENT', pref: [5] },
  { id: 'emp-rahul', name: 'Rahul Verma', pod: 'Alpha', role: 'AGENT', pref: [6] },
  { id: 'emp-pooja', name: 'Pooja Nair', pod: 'Alpha', role: 'AGENT', pref: [5] },
  // Bravo (6)
  { id: 'emp-sanjay', name: 'Sanjay Mehta', pod: 'Bravo', role: 'AGENT', pref: [6] },
  { id: 'emp-divya', name: 'Divya Kapoor', pod: 'Bravo', role: 'AGENT', pref: [5] },
  { id: 'emp-karan', name: 'Karan Malhotra', pod: 'Bravo', role: 'AGENT', pref: [6] },
  { id: 'emp-anjali', name: 'Anjali Desai', pod: 'Bravo', role: 'AGENT', pref: [5] },
  { id: 'emp-manish', name: 'Manish Shah', pod: 'Bravo', role: 'AGENT', pref: [6] },
  { id: 'emp-shreya', name: 'Shreya Pillai', pod: 'Bravo', role: 'AGENT', pref: [5] },
  // Charlie (6)
  { id: 'emp-aditya', name: 'Aditya Rao', pod: 'Charlie', role: 'AGENT', pref: [6] },
  { id: 'emp-sonia', name: 'Sonia Menon', pod: 'Charlie', role: 'AGENT', pref: [5] },
  { id: 'emp-gaurav', name: 'Gaurav Bhat', pod: 'Charlie', role: 'AGENT', pref: [6] },
  { id: 'emp-riya', name: 'Riya Choudhary', pod: 'Charlie', role: 'AGENT', pref: [5] },
  { id: 'emp-nikhil', name: 'Nikhil Agarwal', pod: 'Charlie', role: 'AGENT', pref: [6] },
  { id: 'emp-tanvi', name: 'Tanvi Bansal', pod: 'Charlie', role: 'AGENT', pref: [5] },
  // Delta (6)
  { id: 'emp-kunal', name: 'Kunal Sethi', pod: 'Delta', role: 'AGENT', pref: [6] },
  { id: 'emp-meera', name: 'Meera Jain', pod: 'Delta', role: 'AGENT', pref: [5] },
  { id: 'emp-rohit', name: 'Rohit Khanna', pod: 'Delta', role: 'AGENT', pref: [6] },
  { id: 'emp-ayesha', name: 'Ayesha Oberoi', pod: 'Delta', role: 'AGENT', pref: [5] },
  { id: 'emp-varun', name: 'Varun Chopra', pod: 'Delta', role: 'AGENT', pref: [6] },
  { id: 'emp-isha', name: 'Isha Tandon', pod: 'Delta', role: 'AGENT', pref: [5] },
  // Echo (7: 5 agents + 2 floaters)
  { id: 'emp-akash', name: 'Akash Gulati', pod: 'Echo', role: 'AGENT', pref: [6] },
  { id: 'emp-shruti', name: 'Shruti Arora', pod: 'Echo', role: 'AGENT', pref: [5] },
  { id: 'emp-harsh', name: 'Harsh Mittal', pod: 'Echo', role: 'AGENT', pref: [6] },
  { id: 'emp-nidhi', name: 'Nidhi Sachdeva', pod: 'Echo', role: 'AGENT', pref: [5] },
  { id: 'emp-rohan', name: 'Rohan Batra', pod: 'Echo', role: 'AGENT', pref: [6] },
  { id: 'emp-float1', name: 'Float One (Alex)', pod: 'Echo', role: 'FLOATER', pref: [5, 6] },
  { id: 'emp-float2', name: 'Float Two (Sam)', pod: 'Echo', role: 'FLOATER', pref: [5, 6] },
];

export const DEMO_EMPLOYEES: DemoEmployee[] = RAW_EMPLOYEES.map(e => ({
  id: e.id,
  name: e.name,
  pod_id: `pod-${e.pod.toLowerCase()}`,
  pod: { id: `pod-${e.pod.toLowerCase()}`, name: e.pod },
  role: e.role,
  preferred_off_days: e.pref,
  max_consecutive_days: 6,
  max_cover_per_day: e.role === 'FLOATER' ? 3 : 2,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

export const DEMO_BRANDS = [
  { id: 'b-zenith', name: 'ZENITH', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-aura', name: 'AURA', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-nova', name: 'NOVA', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-pulse', name: 'PULSE', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-quantum', name: 'QUANTUM', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-solar', name: 'SOLAR', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-titan', name: 'TITAN', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-orion', name: 'ORION', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-phoenix', name: 'PHOENIX', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'b-stellar', name: 'STELLAR', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

export const DEMO_PROCESSES = [
  { id: 'p-zenith-cs', brand_id: 'b-zenith', name: 'Customer Support', calendar_mode: 'ALL_365', min_coverage: 1 },
  { id: 'p-aura-cs', brand_id: 'b-aura', name: 'Escalations Desk', calendar_mode: 'ALL_365', min_coverage: 1 },
  { id: 'p-nova-cs', brand_id: 'b-nova', name: 'Tier 1 Support', calendar_mode: 'EXCL_PH', min_coverage: 1 },
  { id: 'p-orion-cs', brand_id: 'b-orion', name: 'Core CS', calendar_mode: 'ALL_365', min_coverage: 2 },
  { id: 'p-orion-ret', brand_id: 'b-orion', name: 'Retention', calendar_mode: 'EXCL_SUN_PH', min_coverage: 1 },
  { id: 'p-phoenix-cs', brand_id: 'b-phoenix', name: 'Omnichannel CS', calendar_mode: 'EXCL_PH', min_coverage: 2 },
];

export const DEMO_LEAVES = [
  {
    id: 'leave-1',
    employee_id: 'emp-amit',
    employee: { id: 'emp-amit', name: 'Amit Kumar', pod: { name: 'Alpha' } },
    leave_type: 'ANNUAL',
    start_date: '2026-11-12',
    end_date: '2026-11-14',
    status: 'APPROVED',
    reason: 'Family visit',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'leave-2',
    employee_id: 'emp-neha',
    employee: { id: 'emp-neha', name: 'Neha Gupta', pod: { name: 'Alpha' } },
    leave_type: 'SICK',
    start_date: '2026-11-18',
    end_date: '2026-11-19',
    status: 'APPROVED',
    reason: 'Medical checkup',
    created_at: '2026-11-05T00:00:00Z',
  },
  {
    id: 'leave-3',
    employee_id: 'emp-karan',
    employee: { id: 'emp-karan', name: 'Karan Malhotra', pod: { name: 'Bravo' } },
    leave_type: 'CASUAL',
    start_date: '2026-11-24',
    end_date: '2026-11-25',
    status: 'PENDING',
    reason: 'Personal errands',
    created_at: '2026-11-08T00:00:00Z',
  },
];

export function generateDemoRoster(month: string) {
  const parts = month.split('-');
  const yearStr = parts[0] || '2026';
  const monthStr = parts[1] || '11';
  const year = parseInt(yearStr, 10) || 2026;
  const monthNum = parseInt(monthStr, 10) || 11;
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const entries: any[] = [];
  const covers: any[] = [];
  const demand: any[] = [];
  const coverage: any[] = [];

  // Generate date strings
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    dates.push(dateStr);

    // Aggregate demand & coverage
    const dayOfWeek = new Date(dateStr).getDay(); // 0 is Sun, 6 is Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const req = isWeekend ? 22 : 28;
    const sup = isWeekend ? 21 : 28;
    demand.push({ date: dateStr, required: req });
    coverage.push({ date: dateStr, supply: sup, gap: Math.max(0, req - sup) });
  }

  // Generate realistic shift entries for each employee across the whole month
  DEMO_EMPLOYEES.forEach((emp, empIdx) => {
    dates.forEach((dateStr, dayIdx) => {
      const dayOfWeek = new Date(dateStr).getDay();
      const dayNum = dayIdx + 1;

      let status = 'WORK';

      // Planted Public Holiday
      if (dayNum === 15 || (monthNum === 12 && dayNum === 25)) {
        status = 'PH';
      }
      // Planted Leaves
      else if (emp.id === 'emp-amit' && dayNum >= 12 && dayNum <= 14) {
        status = 'LEAVE';
      } else if (emp.id === 'emp-neha' && dayNum >= 18 && dayNum <= 19) {
        status = 'LEAVE';
      }
      // Rest Days (Weekly Off) based on preferred off days
      else if (emp.preferred_off_days.includes(dayOfWeek === 0 ? 6 : dayOfWeek - 1)) {
        status = 'WO';
      } else if (dayOfWeek === 0 && (empIdx % 2 === 0)) {
        status = 'WO';
      }
      // Comp-Off example
      else if (dayNum === 16 && empIdx === 3) {
        status = 'COMP_OFF';
      }
      // Floater covers
      else if (emp.role === 'FLOATER' && (dayNum === 13 || dayNum === 14)) {
        status = 'COVER';
        covers.push({
          id: `cov-${emp.id}-${dateStr}`,
          employee_id: emp.id,
          process_id: 'p-zenith-cs',
          date: dateStr,
          source: 'SOLVER',
        });
      }

      entries.push({
        id: `entry-${emp.id}-${dateStr}`,
        employee_id: emp.id,
        employee: emp,
        date: dateStr,
        status,
        locked: dayNum < 5,
        source: 'SOLVER',
        created_at: '2026-11-01T00:00:00Z',
        updated_at: '2026-11-01T00:00:00Z',
      });
    });
  });

  const issues = [
    {
      id: 'iss-1',
      rule: 'STRUCT_NO_BACKUP',
      severity: 'ERROR',
      structural: true,
      brand_id: 'b-zenith',
      message: 'Brand ZENITH has no backup assigned on 365-day calendar mode',
      cause: 'Sole agent assigned without designated secondary cover',
      suggestion_hint: 'Assign Floater One as BACKUP for Zenith Customer Support',
    },
    {
      id: 'iss-2',
      rule: 'COV_BELOW_MIN',
      severity: 'ERROR',
      structural: false,
      brand_id: 'b-phoenix',
      process_id: 'p-phoenix-cs',
      date: `${yearStr}-${monthStr}-14`,
      message: 'Saturday coverage gap: 1 assigned vs 2 required for PHOENIX CS',
      cause: 'Neha Gupta approved leave coincided with weekend peak override',
      suggestion_hint: 'Reallocate Floater Two on Saturday Nov 14',
    },
    {
      id: 'iss-3',
      rule: 'FAIRNESS_SPREAD',
      severity: 'WARNING',
      structural: false,
      message: 'Unbalanced Sunday distribution: Amit Kumar has 4 Sunday shifts vs Pod avg of 2',
      cause: 'Single resource availability pressure during mid-month cycle',
      suggestion_hint: 'Swap Sunday shift with Rahul Verma',
    },
    {
      id: 'iss-4',
      rule: 'CONSEC_MAX',
      severity: 'WARNING',
      structural: false,
      employee_id: 'emp-divya',
      date: `${yearStr}-${monthStr}-22`,
      message: 'Divya Kapoor scheduled for 6 consecutive work days',
      cause: 'Coverage substitution for peer training block',
      suggestion_hint: 'Shift Weekly Off from Tuesday to Monday',
    },
  ];

  return {
    id: `roster-${month}`,
    month,
    status: 'DRAFT',
    generated_at: new Date().toISOString(),
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    entries,
    covers,
    demand,
    coverage,
    employees: DEMO_EMPLOYEES,
    issues,
    approvals: [
      { id: 'app-1', pod_id: 'pod-alpha', pod: { name: 'Alpha' }, status: 'PENDING', comment: null },
      { id: 'app-2', pod_id: 'pod-bravo', pod: { name: 'Bravo' }, status: 'APPROVED', comment: 'All shifts validated' },
      { id: 'app-3', pod_id: 'pod-charlie', pod: { name: 'Charlie' }, status: 'PENDING', comment: null },
      { id: 'app-4', pod_id: 'pod-delta', pod: { name: 'Delta' }, status: 'CHANGES_REQUESTED', comment: 'Need weekend coverage swap' },
      { id: 'app-5', pod_id: 'pod-echo', pod: { name: 'Echo' }, status: 'APPROVED', comment: 'Floaters deployed' },
    ],
    stats: {
      status: 'OPTIMAL',
      objective: 142.5,
      best_bound: 142.5,
      gaps_total: 1,
      gaps_unresolved_by_reason: { LEAVE: 1 },
      solve_ms: 382,
    },
  };
}
