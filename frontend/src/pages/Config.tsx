/**
 * Config Screens - Team configuration management
 */
import { useState } from 'react';
import { configApi } from '../api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { SettingsTab } from '../components/SettingsTab';

export type ConfigTab = 'employees' | 'pods' | 'brands' | 'processes' | 'assignments' | 'holidays' | 'settings';

interface ConfigProps {
  onClose?: () => void;
  initialTab?: ConfigTab;
}

export function Config({ onClose, initialTab = 'employees' }: ConfigProps) {
  const [selectedTab, setSelectedTab] = useState<ConfigTab | null>(null);
  const activeTab = selectedTab ?? initialTab;
  const setActiveTab = (tab: ConfigTab) => setSelectedTab(tab);
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => configApi.listEmployees() });
  const { data: pods } = useQuery({ queryKey: ['pods'], queryFn: () => configApi.listPods() });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: () => configApi.listBrands() });
  const { data: processes } = useQuery({ queryKey: ['processes'], queryFn: () => configApi.listProcesses() });
  const { data: assignments } = useQuery({ queryKey: ['assignments'], queryFn: () => configApi.listAssignments() });
  const { data: holidays } = useQuery({ queryKey: ['holidays'], queryFn: () => configApi.listHolidays() });

  // Mutations
  const createEmployee = useMutation({ mutationFn: configApi.createEmployee, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }) });
  const updateEmployee = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => configApi.updateEmployee(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }) });
  const deleteEmployee = useMutation({ mutationFn: (id: string) => configApi.deleteEmployee(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }) });

  const createPod = useMutation({ mutationFn: configApi.createPod, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pods'] }) });
  const updatePod = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => configApi.updatePod(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pods'] }) });
  const deletePod = useMutation({ mutationFn: (id: string) => configApi.deletePod(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pods'] }) });

  const createBrand = useMutation({ mutationFn: configApi.createBrand, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }) });
  const updateBrand = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => configApi.updateBrand(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }) });
  const deleteBrand = useMutation({ mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) => configApi.deleteBrand(id, confirm), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }) });

  const createProcess = useMutation({ mutationFn: configApi.createProcess, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['processes'] }) });
  const updateProcess = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => configApi.updateProcess(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['processes'] }) });
  const deleteProcess = useMutation({ mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) => configApi.deleteProcess(id, confirm), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['processes'] }) });

  const createAssignment = useMutation({ mutationFn: configApi.createAssignment, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }) });
  const updateAssignment = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => configApi.updateAssignment(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }) });
  const deleteAssignment = useMutation({ mutationFn: (id: string) => configApi.deleteAssignment(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments'] }) });

  const createHoliday = useMutation({ mutationFn: configApi.createHoliday, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }) });
  const deleteHoliday = useMutation({ mutationFn: (id: string) => configApi.deleteHoliday(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }) });

  // Local state for forms
  const [showForm, setShowForm] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  const handleCreate = (type: string) => {
    setEditingItem(null);
    setFormData(getDefaultFormData(type));
    setShowForm(type);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowForm(activeTab);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mutationMap: Record<string, any> = {
      employees: editingItem ? updateEmployee : createEmployee,
      pods: editingItem ? updatePod : createPod,
      brands: editingItem ? updateBrand : createBrand,
      processes: editingItem ? updateProcess : createProcess,
      assignments: editingItem ? updateAssignment : createAssignment,
      holidays: createHoliday,
    };
    const mutation = mutationMap[activeTab];
    if (mutation) {
      if (editingItem) {
        mutation.mutate({ id: editingItem.id, data: formData });
      } else {
        mutation.mutate(formData);
      }
      setShowForm(null);
      setEditingItem(null);
    }
  };

  const handleDelete = (id: string, confirm = false) => {
    if (!confirm && !window.confirm('Delete this item? This action cannot be undone.')) return;
    const mutationMap: Record<string, any> = {
      employees: deleteEmployee,
      pods: deletePod,
      brands: (id: string) => deleteBrand.mutate({ id, confirm }),
      processes: (id: string) => deleteProcess.mutate({ id, confirm }),
      assignments: deleteAssignment,
      holidays: deleteHoliday,
    };
    mutationMap[activeTab]?.(id);
  };

  const getDefaultFormData = (type: string) => {
    switch (type) {
      case 'employees': return { name: '', pod_id: pods?.[0]?.id || '', role: 'AGENT', preferred_off_days: [], max_consecutive_days: 6, max_cover_per_day: 2 };
      case 'pods': return { name: '', lead_employee_id: '' };
      case 'brands': return { name: '', active: true };
      case 'processes': return { brand_id: brands?.[0]?.id || '', name: '', calendar_mode: 'EXCL_SUN_PH', min_coverage: 1 };
      case 'assignments': return { employee_id: employees?.[0]?.id || '', process_id: processes?.[0]?.id || '', type: 'PRIMARY' };
      case 'holidays': return { date: format(new Date(), 'yyyy-MM-dd'), name: '', scope: 'COMPANY', brand_id: '' };
      default: return {};
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'employees': return renderEmployeesTab();
      case 'pods': return renderPodsTab();
      case 'brands': return renderBrandsTab();
      case 'processes': return renderProcessesTab();
      case 'assignments': return renderAssignmentsTab();
      case 'holidays': return renderHolidaysTab();
      case 'settings': return <SettingsTab />;
    }
  };

  function renderEmployeesTab() {
    return (
      <ConfigTable
        title="Employees"
        onAdd={() => handleCreate('employees')}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'pod_id', header: 'Pod', render: (v) => pods?.find((p: any) => p.id === v)?.name || v },
          { key: 'role', header: 'Role' },
          { key: 'preferred_off_days', header: 'Preferred Off', render: (v) => Array.isArray(v) ? v.join(', ') : v },
          { key: 'max_consecutive_days', header: 'Max Consec' },
          { key: 'max_cover_per_day', header: 'Max Cover/Day' },
          { key: 'active', header: 'Active', render: (v) => v ? '✓' : '✗' },
        ]}
        data={employees || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        formFields={[
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'pod_id', label: 'Pod', type: 'select', options: pods?.map((p: any) => ({ value: p.id, label: p.name })) || [], required: true },
          { name: 'role', label: 'Role', type: 'select', options: ['AGENT', 'LEAD', 'FLOATER'].map(v => ({ value: v, label: v })), required: true },
          { name: 'preferred_off_days', label: 'Preferred Off Days (0-6, comma separated)', type: 'text' },
          { name: 'max_consecutive_days', label: 'Max Consecutive Days', type: 'number', min: 1, max: 14 },
          { name: 'max_cover_per_day', label: 'Max Cover Per Day', type: 'number', min: 0 },
          { name: 'active', label: 'Active', type: 'checkbox' },
        ]}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        showForm={showForm === 'employees'}
        setShowForm={() => setShowForm(null)}
        editingItem={editingItem}
      />
    );
  }

  function renderPodsTab() {
    return (
      <ConfigTable
        title="Pods"
        onAdd={() => handleCreate('pods')}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'lead_employee_id', header: 'Lead', render: (v) => employees?.find((e: any) => e.id === v)?.name || v },
        ]}
        data={pods || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        formFields={[
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'lead_employee_id', label: 'Lead Employee', type: 'select', options: employees?.map((e: any) => ({ value: e.id, label: e.name })) || [] },
        ]}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        showForm={showForm === 'pods'}
        setShowForm={() => setShowForm(null)}
        editingItem={editingItem}
      />
    );
  }

  function renderBrandsTab() {
    return (
      <ConfigTable
        title="Brands"
        onAdd={() => handleCreate('brands')}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'active', header: 'Active', render: (v) => v ? '✓' : '✗' },
        ]}
        data={brands || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        formFields={[
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'active', label: 'Active', type: 'checkbox' },
        ]}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        showForm={showForm === 'brands'}
        setShowForm={() => setShowForm(null)}
        editingItem={editingItem}
      />
    );
  }

  function renderProcessesTab() {
    return (
      <ConfigTable
        title="Processes"
        onAdd={() => handleCreate('processes')}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'brand_id', header: 'Brand', render: (v) => brands?.find((b: any) => b.id === v)?.name || v },
          { key: 'calendar_mode', header: 'Calendar Mode' },
          { key: 'min_coverage', header: 'Min Coverage' },
        ]}
        data={processes || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        formFields={[
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'brand_id', label: 'Brand', type: 'select', options: brands?.map((b: any) => ({ value: b.id, label: b.name })) || [], required: true },
          { name: 'calendar_mode', label: 'Calendar Mode', type: 'select', options: ['ALL_365', 'EXCL_PH', 'EXCL_SUN_PH'].map(v => ({ value: v, label: v })), required: true },
          { name: 'min_coverage', label: 'Min Coverage', type: 'number', min: 0, required: true },
        ]}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        showForm={showForm === 'processes'}
        setShowForm={() => setShowForm(null)}
        editingItem={editingItem}
      />
    );
  }

  function renderAssignmentsTab() {
    return (
      <ConfigTable
        title="Assignments"
        onAdd={() => handleCreate('assignments')}
        columns={[
          { key: 'employee_id', header: 'Employee', render: (v) => employees?.find((e: any) => e.id === v)?.name || v },
          { key: 'process_id', header: 'Process', render: (v) => processes?.find((p: any) => p.id === v)?.name || v },
          { key: 'type', header: 'Type' },
        ]}
        data={assignments || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        formFields={[
          { name: 'employee_id', label: 'Employee', type: 'select', options: employees?.map((e: any) => ({ value: e.id, label: e.name })) || [], required: true },
          { name: 'process_id', label: 'Process', type: 'select', options: processes?.map((p: any) => ({ value: p.id, label: p.name })) || [], required: true },
          { name: 'type', label: 'Type', type: 'select', options: ['PRIMARY', 'BACKUP'].map(v => ({ value: v, label: v })), required: true },
        ]}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        showForm={showForm === 'assignments'}
        setShowForm={() => setShowForm(null)}
        editingItem={editingItem}
      />
    );
  }

  function renderHolidaysTab() {
    return (
      <ConfigTable
        title="Holidays"
        onAdd={() => handleCreate('holidays')}
        columns={[
          { key: 'date', header: 'Date', render: (v) => format(new Date(v), 'MMM d, yyyy') },
          { key: 'name', header: 'Name' },
          { key: 'scope', header: 'Scope' },
          { key: 'brand_id', header: 'Brand', render: (v) => v ? brands?.find((b: any) => b.id === v)?.name : 'Company' },
        ]}
        data={holidays || []}
        onEdit={() => {}}
        onDelete={handleDelete}
        formFields={[
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'scope', label: 'Scope', type: 'select', options: ['COMPANY', 'BRAND'].map(v => ({ value: v, label: v })), required: true },
          { name: 'brand_id', label: 'Brand (if BRAND scope)', type: 'select', options: brands?.map((b: any) => ({ value: b.id, label: b.name })) || [] },
        ]}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        showForm={showForm === 'holidays'}
        setShowForm={() => setShowForm(null)}
        editingItem={editingItem}
      />
    );
  }

  const tabs: { id: ConfigTab; label: string }[] = [
    { id: 'employees', label: 'Employees' },
    { id: 'pods', label: 'Pods' },
    { id: 'brands', label: 'Brands' },
    { id: 'processes', label: 'Processes' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Team Configuration</h1>
        {onClose && (
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="border-b border-slate-200 overflow-x-auto px-4">
        <nav className="flex gap-1 pb-2" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => { setActiveTab(tab.id); setShowForm(null); setEditingItem(null); }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#181d26] text-white shadow-xs'
                  : 'text-[#41454d] hover:text-[#181d26] hover:bg-[#f8fafc]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {showForm && activeTab !== 'settings' && (
          <FormModal
            title={editingItem ? `Edit ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`}
            fields={getFormFields(activeTab)}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(null); setEditingItem(null); }}
          />
        )}
        {renderTabContent()}
      </div>
    </div>
  );
}

function getFormFields(tab: ConfigTab) {
  const fieldMap: Record<ConfigTab, any[]> = {
    employees: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'pod_id', label: 'Pod', type: 'select', options: [], required: true },
      { name: 'role', label: 'Role', type: 'select', options: ['AGENT', 'LEAD', 'FLOATER'].map(v => ({ value: v, label: v })), required: true },
      { name: 'preferred_off_days', label: 'Preferred Off Days (0-6, comma separated)', type: 'text' },
      { name: 'max_consecutive_days', label: 'Max Consecutive Days', type: 'number', min: 1, max: 14 },
      { name: 'max_cover_per_day', label: 'Max Cover Per Day', type: 'number', min: 0 },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ],
    pods: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'lead_employee_id', label: 'Lead Employee', type: 'select', options: [] },
    ],
    brands: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ],
    processes: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'brand_id', label: 'Brand', type: 'select', options: [], required: true },
      { name: 'calendar_mode', label: 'Calendar Mode', type: 'select', options: ['ALL_365', 'EXCL_PH', 'EXCL_SUN_PH'].map(v => ({ value: v, label: v })), required: true },
      { name: 'min_coverage', label: 'Min Coverage', type: 'number', min: 0, required: true },
    ],
    assignments: [
      { name: 'employee_id', label: 'Employee', type: 'select', options: [], required: true },
      { name: 'process_id', label: 'Process', type: 'select', options: [], required: true },
      { name: 'type', label: 'Type', type: 'select', options: ['PRIMARY', 'BACKUP'].map(v => ({ value: v, label: v })), required: true },
    ],
    holidays: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'scope', label: 'Scope', type: 'select', options: ['COMPANY', 'BRAND'].map(v => ({ value: v, label: v })), required: true },
      { name: 'brand_id', label: 'Brand (if BRAND scope)', type: 'select', options: [] },
    ],
    settings: [],
  };
  return fieldMap[tab] || [];
}

interface ConfigTableProps {
  title: string;
  onAdd: () => void;
  columns: { key: string; header: string; render?: (v: any) => any }[];
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string, confirm?: boolean) => void;
  formFields: any[];
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  showForm: boolean;
  setShowForm: () => void;
  editingItem: any | null;
}

function ConfigTable({ title, onAdd, columns, data, onEdit, onDelete, formFields, formData, setFormData, onSubmit, showForm, setShowForm, editingItem }: ConfigTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#181d26] tracking-tight">{title}</h2>
        <button onClick={onAdd} className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#181d26] hover:bg-[#0d1218] rounded-xl shadow-xs transition-colors">Add {title.slice(0, -1)}</button>
      </div>

      {showForm && (
        <FormModal
          title={editingItem ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}
          fields={formFields}
          formData={formData}
          setFormData={setFormData}
          onSubmit={onSubmit}
          onClose={setShowForm}
        />
      )}

      <div className="bg-white border border-[#dddddd] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full">
          <thead className="bg-[#f8fafc] border-b border-[#dddddd]">
            <tr>
              {columns.map((col) => <th key={col.key} className="px-4 py-3 text-left text-[11px] font-semibold text-[#41454d] uppercase tracking-wider">{col.header}</th>)}
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#41454d] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dddddd]">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-[#f8fafc] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-xs text-[#181d26]">
                    {col.render ? col.render(item[col.key]) : item[col.key]}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(item)} className="p-1.5 text-[#9297a0] hover:text-[#181d26] rounded-lg hover:bg-white" title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => onDelete(item.id)} className="p-1.5 text-[#9297a0] hover:text-[#aa2d00] rounded-lg hover:bg-[#fef2f2]" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-xs text-[#9297a0]">No {title.toLowerCase()} found. Click "Add {title.slice(0, -1)}" to create one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FormModalProps {
  title: string;
  fields: any[];
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function FormModal({ title, fields, formData, setFormData, onSubmit, onClose }: FormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181d26]/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-[#dddddd] max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[#dddddd] bg-[#f8fafc] flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#181d26]">{title}</h3>
          <button onClick={onClose} className="p-1 text-[#9297a0] hover:text-[#181d26] rounded-lg hover:bg-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-[#181d26] uppercase tracking-wider mb-1">{field.label}{field.required && <span className="text-[#aa2d00] ml-1">*</span>}</label>
              {field.type === 'select' ? (
                <select value={formData[field.name] || ''} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })} className="w-full px-3 py-2 text-xs border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26]" required={field.required}>
                  <option value="">Select...</option>
                  {field.options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData[field.name] || false} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })} className="w-4 h-4 text-[#181d26] border-[#dddddd] rounded focus:ring-[#181d26]" />
                  <span className="text-xs text-[#181d26]">Active</span>
                </label>
              ) : (
                <input type={field.type} value={formData[field.name] || ''} onChange={(e) => setFormData({ ...formData, [field.name]: field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })} className="w-full px-3 py-2 text-xs border border-[#dddddd] rounded-xl focus:outline-none focus:border-[#181d26] text-[#181d26]" min={field.min} max={field.max} required={field.required} />
              )}
            </div>
          ))}
          <div className="flex gap-2.5 pt-4 border-t border-[#dddddd]">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-[#dddddd] rounded-xl text-xs font-medium text-[#181d26] hover:bg-[#f8fafc] transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-[#181d26] text-white rounded-xl text-xs font-medium hover:bg-[#0d1218] transition-colors shadow-xs">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}