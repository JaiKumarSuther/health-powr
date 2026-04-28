import { 
  User, Mail, Phone, MapPin, Calendar, 
  FileText, Clock, Shield, Info
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ClientProfileDrawerProps {
  client: any;
  onEdit: (client: any) => void;
}

export function ClientProfileDrawerContent({ client, onEdit }: ClientProfileDrawerProps) {
  if (!client) return null;

  const sections = [
    {
      title: 'Contact Information',
      icon: <Info className="w-4 h-4" />,
      items: [
        { label: 'Email', value: client.email, icon: <Mail className="w-3.5 h-3.5" /> },
        { label: 'Phone', value: client.phone, icon: <Phone className="w-3.5 h-3.5" /> },
        { label: 'Address', value: client.address, icon: <MapPin className="w-3.5 h-3.5" /> }
      ]
    },
    {
      title: 'Case Management',
      icon: <Shield className="w-4 h-4" />,
      items: [
        { label: 'Case Manager', value: client.caseManager, icon: <User className="w-3.5 h-3.5" /> },
        { label: 'Registration Date', value: new Date(client.registrationDate).toLocaleDateString(), icon: <Calendar className="w-3.5 h-3.5" /> },
        { label: 'Last Contact', value: new Date(client.lastContact).toLocaleDateString(), icon: <Clock className="w-3.5 h-3.5" /> }
      ]
    }
  ];

  return (
    <div className="space-y-8 pb-32 uppercase tracking-tight">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-2xl border border-gray-100 uppercase tracking-tight">
        <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center p-1 mb-4">
          <div className="w-full h-full rounded-full bg-teal-50 flex items-center justify-center">
            <User className="w-10 h-10 text-teal-600" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{client.name}</h3>
        <div className="flex items-center gap-2 mb-4 uppercase tracking-tight">
          <span className={cn(
            "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase",
            client.status === 'active' ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"
          )}>
            {client.status}
          </span>
          <span className={cn(
            "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase",
            client.priority === 'high' ? "bg-red-100 text-red-700" : 
            client.priority === 'medium' ? "bg-yellow-100 text-yellow-700" : 
            "bg-blue-100 text-blue-700"
          )}>
            {client.priority} Priority
          </span>
        </div>
        <button 
          onClick={() => onEdit(client)}
          className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-[14px] font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Edit Profile
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 uppercase tracking-tight">
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-center">
          <p className="text-[20px] font-bold text-blue-700">{client.applications}</p>
          <p className="text-[11px] font-bold text-blue-600 uppercase">Active Apps</p>
        </div>
        <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-100 text-center">
          <p className="text-[20px] font-bold text-teal-700">{client.completedServices}</p>
          <p className="text-[11px] font-bold text-teal-600 uppercase">Completed</p>
        </div>
      </div>

      {/* Profile Sections */}
      {sections.map((section, idx) => (
        <div key={idx} className="space-y-4 uppercase tracking-tight">
          <div className="flex items-center gap-2 text-gray-400 font-bold text-[12px] uppercase">
            {section.icon}
            <span>{section.title}</span>
          </div>
          <div className="grid gap-3 uppercase tracking-tight">
            {section.items.map((item, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 rounded-xl bg-white border border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase">{item.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-teal-600">{item.icon}</span>
                  <span className="text-[14px] font-medium text-gray-900">{item.value || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Notes Section */}
      <div className="space-y-4 uppercase tracking-tight">
        <div className="flex items-center gap-2 text-gray-400 font-bold text-[12px] uppercase">
          <FileText className="w-4 h-4" />
          <span>Case Notes</span>
        </div>
        <div className="p-4 rounded-xl bg-yellow-50/30 border border-yellow-100 text-[14px] text-gray-700 leading-relaxed italic uppercase tracking-tight">
          "{client.notes || 'No recent notes'}"
        </div>
      </div>
    </div>
  );
}
