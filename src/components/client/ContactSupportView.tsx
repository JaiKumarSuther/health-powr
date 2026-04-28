import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, Mail, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

const faqs = [
  {
    q: 'How do I submit a service request?',
    a: 'Go to Find Services, browse or search for a service that matches your need, then click "Apply for Service". Fill out the form and submit — an organization will be assigned to follow up.'
  },
  {
    q: 'How long does it take to hear back?',
    a: 'Organizations typically respond within 2–3 business days. You can track your request status anytime in the Applications section.'
  },
  {
    q: 'Can I submit multiple requests?',
    a: 'Yes. You can submit requests for different service categories at the same time. Each request is tracked separately.'
  },
  {
    q: 'How do I update my profile information?',
    a: 'Click your name or avatar in the top right corner, then select "Account Settings" or "My Profile" to edit your information.'
  },
  {
    q: 'What if I need emergency help right now?',
    a: 'Visit the Emergency Resources page for crisis hotlines including 911, 988 (mental health), and the NYC DHS shelter line.'
  },
]

export function ContactSupportView() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const navigate = useNavigate()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-teal-50 rounded-xl">
          <HelpCircle className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Support</h1>
          <p className="text-sm text-gray-500 mt-0.5">We're here to help. We'll get back to you within 24 hours.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="mailto:support@healthpowr.app"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-50 rounded-lg">
              <Mail className="w-4 h-4 text-teal-600" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">Email Support</p>
          </div>
          <p className="text-xs text-gray-500">support@healthpowr.app</p>
          <p className="text-xs text-teal-600 mt-2 font-medium">Send us an email →</p>
        </a>

        <button
          onClick={() => navigate('/client/community')}
          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors text-left">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-50 rounded-lg">
              <MessageSquare className="w-4 h-4 text-teal-600" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">Community Forum</p>
          </div>
          <p className="text-xs text-gray-500">Ask questions and connect with others</p>
          <p className="text-xs text-teal-600 mt-2 font-medium">Go to forum →</p>
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-700">Frequently Asked Questions</h2>
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors">
              <span className="text-sm font-medium text-gray-900">{faq.q}</span>
              {openIndex === i
                ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
            </button>
            {openIndex === i && (
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

