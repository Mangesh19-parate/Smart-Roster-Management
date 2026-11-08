/**
 * Styleguide Page - Design token showcase and UI primitive reference (T34)
 */
import { Link } from 'react-router-dom';
import { colors } from '../design/tokens';

export function Styleguide() {
  const statusEntries = Object.entries(colors.status);
  const severityEntries = Object.entries(colors.severity);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Design System & Primitives</h1>
          <p className="text-sm text-slate-500">Living token reference matching DESIGN.md tokens</p>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Back to Roster
        </Link>
      </div>

      {/* Status Badges */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Roster Status Tokens</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {statusEntries.map(([name, item]) => (
            <div
              key={name}
              style={{ backgroundColor: item.bg, color: item.text }}
              className="p-3 rounded-md border border-slate-200 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-base font-bold">{item.code}</span>
              <span className="text-xs capitalize">{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Severity Tokens */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Issue Severity Badges</h2>
        <div className="flex flex-wrap gap-4">
          {severityEntries.map(([name, item]) => (
            <span
              key={name}
              style={{ backgroundColor: item.bg, color: item.text, borderColor: item.border }}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Button Primitives</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700">
            Primary Action
          </button>
          <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50">
            Secondary Action
          </button>
          <button className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-md hover:bg-rose-700">
            Destructive Action
          </button>
          <button disabled className="px-4 py-2 bg-slate-200 text-slate-400 text-sm font-medium rounded-md cursor-not-allowed">
            Disabled Action
          </button>
        </div>
      </section>
    </div>
  );
}
