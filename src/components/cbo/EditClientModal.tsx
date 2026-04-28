import React, { useState, useEffect } from 'react';
import { X, User, Save } from 'lucide-react';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, '');
}

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  onSave: (updatedClient: any) => void;
}

export function EditClientModal({ isOpen, onClose, client, onSave }: EditClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    status: '',
    priority: '',
    caseManager: '',
    notes: ''
  });
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        status: client.status || 'active',
        priority: client.priority || 'medium',
        caseManager: client.caseManager || '',
        notes: client.notes || ''
      });
    }
  }, [client]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (formData.email && !isValidEmail(formData.email)) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (formData.phone && !/^\d+$/.test(formData.phone)) {
      nextErrors.phone = 'Phone must contain digits only.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ ...client, ...formData });
    onClose();
  };

  const inputClass = "w-full px-4 h-12 md:h-11 border border-gray-200 rounded-xl text-[16px] md:text-[14px] focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none transition-all placeholder-gray-400 uppercase tracking-tight";
  const labelClass = "block text-[12px] font-bold text-gray-500 mb-1.5 uppercase";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto uppercase tracking-tight">
        <div className="sticky top-0 bg-white p-5 md:p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <User className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 uppercase">Edit Client Profile</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase tracking-tight">
            {/* Name */}
            <div className="md:col-span-2">
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={inputClass}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                className={inputClass}
                required
              />
              {errors.email && (
                <p className="mt-1 text-[12px] font-medium text-red-600 normal-case">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                inputMode="numeric"
                pattern="\d*"
                onChange={(e) => {
                  const next = digitsOnly(e.target.value);
                  setFormData({ ...formData, phone: next });
                  if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
                }}
                className={inputClass}
                required
              />
              {errors.phone && (
                <p className="mt-1 text-[12px] font-medium text-red-600 normal-case">
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className={labelClass}>Residential Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className={inputClass}
                required
              />
            </div>

            {/* Status */}
            <div>
              <label className={labelClass}>Client Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className={labelClass}>Case Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Case Manager */}
            <div>
              <label className={labelClass}>Assigned Case Manager</label>
              <input
                type="text"
                value={formData.caseManager}
                onChange={(e) => setFormData({...formData, caseManager: e.target.value})}
                className={inputClass}
                required
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className={labelClass}>Case Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className={cn(inputClass, "h-32 py-3 resize-none")}
                placeholder="Add recent updates or important information..."
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-100 uppercase tracking-tight">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-100 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 uppercase"
            >
              <Save className="w-5 h-5" />
              <span>Update Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
