/**
 * CellEditModal - Airtable Inspired Modal for Updating Individual Roster Entries
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181d26]/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-xl border border-[#dddddd] w-full max-w-lg overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-edit-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#dddddd] flex items-center justify-between bg-[#f8fafc]">
          <div>
            <h3 id="cell-edit-title" className="text-base font-semibold text-[#181d26]">
              Edit Shift Assignment
            </h3>
            <p className="text-xs text-[#41454d] mt-0.5">
              Modify operational status and locking parameters
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#9297a0] hover:text-[#181d26] hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Employee & Date Summary Card */}
          <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#dddddd] grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs font-medium text-[#41454d] block">Employee</span>
              <span className="font-semibold text-[#181d26]">{employee.name}</span>
              <span className="text-xs text-[#41454d] block">{employee.pod ? `Pod: ${employee.pod}` : employee.role}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-[#41454d] block">Date</span>
              <span className="font-medium text-[#181d26]">{formattedDate}</span>
              <span className="text-xs text-[#41454d] block">Current Status: {currentStatus}</span>
            </div>
          </div>

          {/* Active Issues Warning */}
          {issues.length > 0 && (
            <div className="p-3 rounded-xl bg-[#fff8e1] border border-[#fde68a] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#b45309]">
                <AlertTriangle className="w-4 h-4 text-[#d9a441] shrink-0" />
                <span>{issues.length} scheduling issue(s) detected for this date:</span>
              </div>
              <ul className="text-xs text-[#b45309] list-disc list-inside space-y-0.5 pl-1">
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
            <label htmlFor="shift-status" className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider">
              Shift Status
            </label>
            <select
              id="shift-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#dddddd] rounded-xl shadow-xs focus:outline-none focus:border-[#181d26] font-medium text-[#181d26]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Locked Status Checkbox */}
          <div className="p-3 rounded-xl border border-[#dddddd] bg-[#f8fafc] flex items-start gap-3">
            <div className="pt-0.5">
              <input
                type="checkbox"
                id="lock-entry"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                className="w-4 h-4 text-[#181d26] border-[#dddddd] rounded focus:ring-[#181d26] cursor-pointer"
              />
            </div>
            <div className="text-xs">
              <label htmlFor="lock-entry" className="font-medium text-[#181d26] flex items-center gap-1.5 cursor-pointer">
                {locked ? <Lock className="w-3.5 h-3.5 text-[#181d26]" /> : <Unlock className="w-3.5 h-3.5 text-[#9297a0]" />}
                Lock entry against regeneration
              </label>
              <p className="text-[#41454d] mt-0.5">
                Preserves this specific status during automated solver regeneration.
              </p>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label htmlFor="edit-reason" className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider">
              Change Reason <span className="text-[#9297a0] font-normal">(Optional)</span>
            </label>
            <input
              id="edit-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved shift swap with Team Lead"
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#dddddd] rounded-xl shadow-xs focus:outline-none focus:border-[#181d26] text-[#181d26]"
            />
          </div>

          {/* Modal Footer - Airtable Button Pair */}
          <div className="pt-3 border-t border-[#dddddd] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-xl hover:bg-[#f8fafc] hover:border-[#9297a0] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4.5 py-2 text-sm font-medium text-white bg-[#181d26] hover:bg-[#0d1218] rounded-xl shadow-xs disabled:opacity-50 transition-colors"
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
