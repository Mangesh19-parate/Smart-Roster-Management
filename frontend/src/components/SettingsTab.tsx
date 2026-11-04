/**
 * Settings Tab - Global settings configuration
 */
import { useState } from 'react';
import { configApi } from '../api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function SettingsForm({ initialSettings, onSave }: { initialSettings: any; onSave: (data: any) => void }) {
  const [settingsForm, setSettingsForm] = useState(
    initialSettings || { weekly_rest_days: 1, max_consecutive_days: 6, week_start: 'MON', solver_weights: {} }
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(settingsForm); }} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Weekly Rest Days</label>
        <input type="number" min="1" max="7" value={settingsForm.weekly_rest_days} onChange={(e) => setSettingsForm({ ...settingsForm, weekly_rest_days: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Max Consecutive Working Days</label>
        <input type="number" min="1" max="14" value={settingsForm.max_consecutive_days} onChange={(e) => setSettingsForm({ ...settingsForm, max_consecutive_days: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Week Start</label>
        <select value={settingsForm.week_start} onChange={(e) => setSettingsForm({ ...settingsForm, week_start: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Settings</button>
    </form>
  );
}

export function SettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => configApi.getSettings() });
  const updateSettings = useMutation({ mutationFn: configApi.updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Global Settings</h2>
      </div>

      {isLoading ? (
        <div className="text-slate-500">Loading settings...</div>
      ) : (
        <SettingsForm
          key={JSON.stringify(settings)}
          initialSettings={settings}
          onSave={(data) => updateSettings.mutate(data)}
        />
      )}
    </div>
  );
}