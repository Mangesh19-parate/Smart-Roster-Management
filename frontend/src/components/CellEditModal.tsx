/**
 * CellEditModal - Enterprise modal for updating individual roster entries
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X, Lock, Unlock, AlertTriangle, Check } from 'lucide-react';

interface CellEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: { id: string; name: string; pod?: string; role?: string } | null;
  date: string;
  currentStatus: string;
  isLocked: boolean;
  issues: any[];
  onSave: (data: { employee_id: string; date: string; status: string; locked: boolean; reason?: string }) => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'WORK', label: 'Work (Working Shift)', desc: 'Standard operational working shift' },
  { value: 'WO', label: 'Weekly Off (WO)', desc: 'Scheduled weekly rest day' },
  { value: 'LEAVE', label: 'Approved Leave', desc: 'Planned or approved absence' },
  { value: 'COMP_OFF', label: 'Comp-off (CO)', desc: 'Compensatory day off earned' },
  { value: 'PH', label: 'Public Holiday (PH)', desc: 'Gazetted public holiday' },
];

export function CellEditModal({
  isOpen,
  onClose,
  employee,
  date,
  currentStatus,
  isLocked,
  issues,
  onSave,
  isLoading = false,
}: CellEditModalProps) {
  const [status, setStatus] = useState<string>(currentStatus || 'WORK');
  const [locked, setLocked] = useState<boolean>(isLocked);
  const [reason, setReason] = useState<string>('');

  if (!isOpen || !employee) return null;

  const formattedDate = date ? format(parseISO(date), 'EEEE, MMMM d, yyyy') : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      employee_id: employee.id,
      date,
      status,
      locked,
      reason: reason.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-edit-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 id="cell-edit-title" className="text-base font-semibold text-slate-900">
              Edit Shift Assignment
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Modify operational status and locking parameters
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Employee & Date Summary Card */}
          <div className="bg-slate-50/80 rounded-md p-3 border border-slate-200 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs font-medium text-slate-500 block">Employee</span>
              <span className="font-semibold text-slate-900">{employee.name}</span>
              <span className="text-xs text-slate-500 block">{employee.pod ? `Pod: ${employee.pod}` : employee.role}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block">Date</span>
              <span className="font-medium text-slate-900">{formattedDate}</span>
              <span className="text-xs text-slate-500 block">Current Status: {currentStatus}</span>
            </div>
          </div>

          {/* Active Issues Warning */}
          {issues.length > 0 && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{issues.length} scheduling issue(s) detected for this date:</span>
              </div>
              <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5 pl-1">
                {issues.map((iss, idx) => (
                  <li key={idx} className="truncate">
                    {iss.message || iss.description || iss.rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status Selection */}
          <div className="space-y-1.5">
            <label htmlFor="shift-status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Shift Status
            </label>
            <select
              id="shift-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Locked Status Checkbox */}
          <div className="p-3 rounded-md border border-slate-200 bg-slate-50/50 flex items-start gap-3">
            <div className="pt-0.5">
              <input
                type="checkbox"
                id="lock-entry"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="text-xs">
              <label htmlFor="lock-entry" className="font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                {locked ? <Lock className="w-3.5 h-3.5 text-indigo-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                Lock entry against regeneration
              </label>
              <p className="text-slate-500 mt-0.5">
                Preserves this specific status during automated solver regeneration.
              </p>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label htmlFor="edit-reason" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Change Reason <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="edit-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved shift swap with Team Lead"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
