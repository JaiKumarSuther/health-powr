import { BarChart2, Clock, TrendingUp, FileText } from 'lucide-react';

export function ReportsView() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex-shrink-0">
        <h1 className="text-lg font-bold text-slate-900">Reports</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Outcome reporting and analytics for your organization
        </p>
      </div>

      {/* Coming soon body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-5">
          <BarChart2 className="w-7 h-7 text-teal-600" strokeWidth={1.5} />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Reports coming soon</h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-8">
          Your reporting dashboard is being built. Once live, you'll be able to track outcomes,
          export data for funders, and measure your organization's impact.
        </p>

        {/* Preview cards — what's coming */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
          {[
            {
              icon: TrendingUp,
              title: 'Requests over time',
              desc: 'Volume trends by week and month',
            },
            {
              icon: FileText,
              title: 'Funder exports',
              desc: 'PDF and CSV outcome reports',
            },
            {
              icon: Clock,
              title: 'Response time',
              desc: 'Average time to resolution by category',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-slate-100 p-4 text-left opacity-50"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <item.icon className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-semibold text-slate-700 mb-1">{item.title}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

