/**
 * Leave Dialog - Airtable Inspired Leave Request & Impact Preview Modal
 */
import { useState } from 'react';
import { leavesApi } from '../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, CalendarOff } from 'lucide-react';

interface LeaveDialogProps {
  month: string;
  onClose: () => void;
  employees: any[];
}

interface LeaveFormData {
  employee_id: string;
  start_date: string;
  end_date: string;
  type: 'PLANNED' | 'COMP_OFF' | 'SICK';
}

const LEAVE_TYPES = [
  { value: 'PLANNED', label: 'Planned Leave' },
  { value: 'COMP_OFF', label: 'Comp Off' },
  { value: 'SICK', label: 'Sick Leave' },
];

export function LeaveDialog({ month, onClose, employees }: LeaveDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<LeaveFormData>({
    employee_id: employees[0]?.id || '',
    start_date: format(new Date(`${month}-01`), 'yyyy-MM-dd'),
    end_date: format(new Date(`${month}-01`), 'yyyy-MM-dd'),
    type: 'PLANNED',
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previewMutation = useMutation({
    mutationFn: (data: LeaveFormData) => leavesApi.preview(data),
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreview(true);
    },
    onError: (err: any) => alert(`Preview failed: ${err.message}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: LeaveFormData) => leavesApi.create(data),
    onMutate: () => setSubmitting(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', month] });
      queryClient.invalidateQueries({ queryKey: ['issues', month] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      onClose();
    },
    onError: (err: any) => alert(`Create leave failed: ${err.message}`),
    onSettled: () => setSubmitting(false),
  });

  const handlePreview = () => {
    previewMutation.mutate(formData);
  };

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setShowPreview(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181d26]/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-[#dddddd] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-[#dddddd] bg-[#f8fafc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-[#181d26]" />
            <h3 className="font-semibold text-sm text-[#181d26]">Request Leave</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#9297a0] hover:text-[#181d26] rounded-xl hover:bg-white border border-transparent hover:border-[#dddddd] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showPreview ? (
          <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); handlePreview(); }}>
            <div>
              <label className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1.5">
                Employee <span className="text-[#aa2d00]">*</span>
              </label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3.5 py-2 text-xs border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26]"
                required
              >
                <option value="">Select employee...</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.pod?.name || 'No Pod'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1.5">
                  Start Date <span className="text-[#aa2d00]">*</span>
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleDateChange('start_date', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1.5">
                  End Date <span className="text-[#aa2d00]">*</span>
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleDateChange('end_date', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1.5">
                Leave Type <span className="text-[#aa2d00]">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3.5 py-2 text-xs border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26]"
                required
              >
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Airtable Button Pair */}
            <div className="flex gap-2.5 pt-4 border-t border-[#dddddd]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[#dddddd] rounded-xl text-xs font-medium text-[#181d26] hover:bg-[#f8fafc] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#181d26] text-white rounded-xl text-xs font-medium hover:bg-[#0d1218] active:bg-[#000000] disabled:opacity-50 transition-colors shadow-xs"
              >
                {previewMutation.isPending ? 'Previewing...' : 'Preview Impact'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            {/* Airtable Cream Summary Card */}
            <div className="bg-[#f5e9d4] border border-[#dddddd] rounded-xl p-4">
              <h4 className="font-semibold text-xs text-[#181d26] uppercase tracking-wider mb-2">Impact Preview</h4>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="font-medium text-[#41454d]">New Issues: </span>
                  <span className="font-semibold text-[#aa2d00]">{previewData?.impact?.new_issues?.length || 0}</span>
                </div>
                <div>
                  <span className="font-medium text-[#41454d]">Resolved Issues: </span>
                  <span className="font-semibold text-[#006400]">{previewData?.impact?.resolved_issues?.length || 0}</span>
                </div>
                <div>
                  <span className="font-medium text-[#41454d]">Affected Brands: </span>
                  <span className="font-semibold text-[#181d26]">{previewData?.impact?.affected_brands?.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>

            {previewData?.impact?.new_issues?.length > 0 && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4">
                <h5 className="font-semibold text-xs text-[#aa2d00] uppercase tracking-wider mb-2">New Issues Created:</h5>
                <ul className="space-y-1 text-xs">
                  {previewData.impact.new_issues.map((issue: any) => (
                    <li key={issue.id} className="text-[#aa2d00]">
                      {issue.rule}: {issue.message} ({issue.cause})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previewData?.impact?.resolved_issues?.length > 0 && (
              <div className="bg-[#e8f5e9] border border-[#c8e6c9] rounded-xl p-4">
                <h5 className="font-semibold text-xs text-[#006400] uppercase tracking-wider mb-2">Issues Resolved:</h5>
                <ul className="space-y-1 text-xs">
                  {previewData.impact.resolved_issues.map((issue: any) => (
                    <li key={issue.id} className="text-[#006400]">
                      {issue.rule}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2.5 pt-4 border-t border-[#dddddd]">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-2 border border-[#dddddd] rounded-xl text-xs font-medium text-[#181d26] hover:bg-[#f8fafc] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-[#181d26] text-white rounded-xl text-xs font-medium hover:bg-[#0d1218] active:bg-[#000000] disabled:opacity-50 transition-colors shadow-xs"
              >
                {submitting ? 'Creating...' : 'Create Leave'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
