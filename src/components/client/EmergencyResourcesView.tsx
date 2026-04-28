import { Phone, AlertTriangle, ExternalLink } from 'lucide-react'

const hotlines = [
  { title: 'Emergency Services', number: '911', description: 'For immediate danger — call now', urgent: true },
  { title: 'NYC 311', number: '311', description: 'Non-emergency city services, housing, food assistance', urgent: false },
  { title: 'Suicide & Crisis Lifeline', number: '988', description: 'Call or text 988 — 24/7 mental health crisis support', urgent: false },
  { title: 'Crisis Text Line', number: 'Text HOME to 741741', description: 'Free 24/7 crisis support via text message', urgent: false },
  { title: 'NYC Domestic Violence Hotline', number: '1-800-621-4673', description: 'Safe Horizon — 24/7 confidential support', urgent: false },
  { title: 'NYC Health + Hospitals', number: '1-844-692-4692', description: 'NYC public health system — medical help and referrals', urgent: false },
]

const resources = [
  { title: 'NYC DHS Shelter Finder', url: 'https://www1.nyc.gov/site/dhs/shelter/shelter.page', description: 'Find emergency shelter in NYC' },
  { title: 'Food Bank for NYC', url: 'https://www.foodbanknyc.org', description: 'Find food pantries and emergency food near you' },
  { title: 'NYC Human Resources Administration', url: 'https://www.nyc.gov/hra', description: 'Benefits, cash assistance, SNAP enrollment' },
]

export function EmergencyResourcesView() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Resources</h1>
          <p className="text-sm text-gray-500 mt-0.5">If you are in immediate danger, call 911 now.</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700">Crisis Hotlines</h2>
        {hotlines.map((h) => (
          <div key={h.title} className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${h.urgent ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg mt-0.5 ${h.urgent ? 'bg-red-100' : 'bg-teal-50'}`}>
                <Phone className={`w-4 h-4 ${h.urgent ? 'text-red-600' : 'text-teal-600'}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{h.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{h.description}</p>
              </div>
            </div>
            <a href={`tel:${h.number.replace(/\\D/g, '')}`} className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-lg ${h.urgent ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
              {h.number}
            </a>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700">Online Resources</h2>
        {resources.map((r) => (
          <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-teal-300 transition-colors block">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  )
}

