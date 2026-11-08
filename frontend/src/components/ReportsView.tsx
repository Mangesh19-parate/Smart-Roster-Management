/**
 * ReportsView - Enterprise Hub for Structural Integrity and Workload Fairness Reports
 */
import { useState } from 'react';
import { StructuralReport } from '../pages/StructuralReport';
import { FairnessReport } from '../pages/FairnessReport';
import { FileCheck2, Scale } from 'lucide-react';

interface ReportsViewProps {
  month: string;
}

export function ReportsView({ month }: ReportsViewProps) {
  const [activeReport, setActiveReport] = useState<'structural' | 'fairness'>('structural');

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Tab Switcher */}
      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="inline-flex rounded-md p-1 bg-slate-100 border border-slate-200" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'structural'}
            onClick={() => setActiveReport('structural')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeReport === 'structural'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Structural Diagnostics</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'fairness'}
            onClick={() => setActiveReport('fairness')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeReport === 'fairness'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Fairness & Balancing</span>
          </button>
        </div>
      </div>

      {/* Embedded Report Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-4 min-h-[500px]">
        {activeReport === 'structural' ? (
          <StructuralReport month={month} />
        ) : (
          <FairnessReport month={month} />
        )}
      </div>
    </div>
  );
}
