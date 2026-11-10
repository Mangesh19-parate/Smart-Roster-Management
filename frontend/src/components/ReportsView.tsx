/**
 * ReportsView - Airtable Inspired Enterprise Hub for Structural Integrity and Workload Fairness Reports
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
      {/* Tab Switcher - Airtable Pill Switcher */}
      <div className="bg-white p-2.5 rounded-xl border border-[#dddddd] shadow-xs flex items-center justify-between">
        <div className="inline-flex rounded-xl p-0.5 bg-[#f8fafc] border border-[#dddddd]" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeReport === 'structural'}
            onClick={() => setActiveReport('structural')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg transition-all ${
              activeReport === 'structural'
                ? 'bg-[#181d26] text-white shadow-xs font-medium'
                : 'text-[#41454d] hover:text-[#181d26]'
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
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg transition-all ${
              activeReport === 'fairness'
                ? 'bg-[#181d26] text-white shadow-xs font-medium'
                : 'text-[#41454d] hover:text-[#181d26]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Fairness & Balancing</span>
          </button>
        </div>
      </div>

      {/* Embedded Report Container */}
      <div className="bg-white rounded-xl border border-[#dddddd] shadow-xs p-6 min-h-[500px]">
        {activeReport === 'structural' ? (
          <StructuralReport month={month} />
        ) : (
          <FairnessReport month={month} />
        )}
      </div>
    </div>
  );
}
