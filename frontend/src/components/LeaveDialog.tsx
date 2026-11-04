/**
 * Leave Dialog - Add/edit leave with impact preview
 */
import { useState } from 'react';
import { leavesApi } from '../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Add Leave</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {!showPreview ? (
          <form className="p-4 space-y-4" onSubmit={(e) => { e.preventDefault(); handlePreview(); }}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employee <span className="text-red-500">*</span></label>
              <select value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select employee...</option>
                {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.pod?.name || 'No Pod'})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                <input type="date" value={formData.start_date} onChange={(e) => handleDateChange('start_date', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date <span className="text-red-500">*</span></label>
                <input type="date" value={formData.end_date} onChange={(e) => handleDateChange('end_date', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type <span className="text-red-500">*</span></label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handlePreview} disabled={previewMutation.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {previewMutation.isPending ? 'Previewing...' : 'Preview Impact'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">Impact Preview</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-slate-700">New Issues: </span>
                  <span className="text-red-600">{previewData?.impact?.new_issues?.length || 0}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Resolved Issues: </span>
                  <span className="text-green-600">{previewData?.impact?.resolved_issues?.length || 0}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Affected Brands: </span>
                  <span className="text-slate-700">{previewData?.impact?.affected_brands?.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>

            {previewData?.impact?.new_issues?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h5 className="font-medium text-red-800 mb-2">New Issues Created:</h5>
                <ul className="space-y-1 text-sm">
                  {previewData.impact.new_issues.map((issue: any) => (
                    <li key={issue.id} className="text-red-700">
                      {issue.rule}: {issue.message} ({issue.cause})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previewData?.impact?.resolved_issues?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h5 className="font-medium text-green-800 mb-2">Issues Resolved:</h5>
                <ul className="space-y-1 text-sm">
                  {previewData.impact.resolved_issues.map((issue: any) => (
                    <li key={issue.id} className="text-green-700">
                      {issue.rule}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button onClick={() => setShowPreview(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50">Back</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Leave'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}