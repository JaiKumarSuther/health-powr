import React, { useState } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  User, 
  Home, 
  DollarSign, 
  FileText, 
  Upload,
  Save,
  Eye,
  AlertCircle,
  X
} from 'lucide-react';

interface FormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  fields: FormField[];
  completed: boolean;
  optional?: boolean;
}

interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'file' | 'checkbox' | 'number';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  value?: any;
  error?: string;
  helpText?: string;
}

interface ApplicationFormProps {
  serviceName: string;
  organization: string;
  onSubmit: (data: any) => void;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function ApplicationForm({ serviceName, organization, onSubmit, onSave, onCancel }: ApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const steps: FormStep[] = [
    {
      id: 'personal',
      title: 'Personal Information',
      description: 'Basic information about you',
      icon: User,
      completed: false,
      fields: [
        {
          id: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          placeholder: 'Enter your first name'
        },
        {
          id: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          placeholder: 'Enter your last name'
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          placeholder: 'your.email@example.com'
        },
        {
          id: 'phone',
          type: 'phone',
          label: 'Phone Number',
          required: true,
          placeholder: '(555) 123-4567'
        },
        {
          id: 'dateOfBirth',
          type: 'text',
          label: 'Date of Birth',
          required: true,
          placeholder: 'MM/DD/YYYY'
        }
      ]
    },
    {
      id: 'household',
      title: 'Household Information',
      description: 'Information about your household',
      icon: Home,
      completed: false,
      fields: [
        {
          id: 'householdSize',
          type: 'select',
          label: 'Household Size',
          required: true,
          options: ['1 person', '2 people', '3 people', '4 people', '5+ people']
        },
        {
          id: 'address',
          type: 'textarea',
          label: 'Current Address',
          required: true,
          placeholder: 'Enter your full address'
        },
        {
          id: 'housingStatus',
          type: 'select',
          label: 'Current Housing Status',
          required: true,
          options: ['Owned', 'Rented', 'Staying with family/friends', 'Homeless', 'Other']
        },
        {
          id: 'emergencyContact',
          type: 'text',
          label: 'Emergency Contact',
          required: false,
          placeholder: 'Name and phone number'
        }
      ]
    },
    {
      id: 'financial',
      title: 'Financial Information',
      description: 'Income and financial details',
      icon: DollarSign,
      completed: false,
      fields: [
        {
          id: 'monthlyIncome',
          type: 'number',
          label: 'Monthly Household Income',
          required: true,
          placeholder: 'Enter amount in dollars',
          helpText: 'Include all sources of income for your household'
        },
        {
          id: 'incomeSource',
          type: 'select',
          label: 'Primary Income Source',
          required: true,
          options: ['Employment', 'Self-employment', 'Benefits', 'Disability', 'Retirement', 'Other', 'No income']
        },
        {
          id: 'hasAssets',
          type: 'checkbox',
          label: 'I have significant assets (savings, property, etc.)',
          required: false
        }
      ]
    },
    {
      id: 'documents',
      title: 'Supporting Documents',
      description: 'Upload required documentation',
      icon: FileText,
      completed: false,
      optional: true,
      fields: [
        {
          id: 'idDocument',
          type: 'file',
          label: 'Photo ID',
          required: true,
          helpText: 'Driver\'s license, state ID, or passport'
        },
        {
          id: 'incomeProof',
          type: 'file',
          label: 'Proof of Income',
          required: true,
          helpText: 'Pay stubs, benefit letters, or tax returns'
        },
        {
          id: 'additionalDocs',
          type: 'file',
          label: 'Additional Documents',
          required: false,
          helpText: 'Any other supporting documentation'
        }
      ]
    }
  ];

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaveStatus('saved');
    onSave(formData);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const validateStep = (stepIndex: number) => {
    const step = steps[stepIndex];
    const requiredFields = step.fields.filter(field => field.required);
    return requiredFields.every(field => formData[field.id]);
  };

  const canProceed = validateStep(currentStep);
  const isLastStep = currentStep === steps.length - 1;

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
          >
            <option value="">Select an option...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'checkbox':
        return (
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span className="text-gray-700">{field.label}</span>
          </label>
        );
      
      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Click to upload or drag and drop
            </p>
            <input
              type="file"
              onChange={(e) => handleFieldChange(field.id, e.target.files?.[0])}
              className="hidden"
              id={field.id}
            />
            <label
              htmlFor={field.id}
              className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer transition-colors"
            >
              Choose File
            </label>
            {value && (
              <p className="text-sm text-teal-700 mt-2">
                ✓ {value.name || 'File uploaded'}
              </p>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-gray-900 mb-1 md:mb-2">Application Form</h1>
            <p className="text-[14px] md:text-[16px] text-gray-600">
              Applying for: <span className="font-semibold text-teal-600">{serviceName}</span> at {organization}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`flex justify-center items-center gap-[8px] bg-white text-gray-700 border border-gray-200 px-4 min-h-[44px] rounded-lg font-medium text-[14px] transition-all cursor-pointer ${
                saveStatus === 'saving' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {saveStatus === 'saving' ? 'Saving...' : 
                 saveStatus === 'saved' ? 'Saved!' : 'Save Draft'}
              </span>
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex justify-center items-center gap-[8px] bg-white text-gray-700 border border-gray-200 px-4 min-h-[44px] rounded-lg font-medium text-[14px] hover:bg-gray-50 transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center space-x-2 px-4 min-h-[44px] text-gray-600 hover:text-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Step Navigation Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200 p-5 sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-4">Application Steps</h3>
            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = step.completed || validateStep(index);
                
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(index)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all ${
                      isActive 
                        ? 'bg-teal-50 border-teal-600 text-teal-700'
                        : isCompleted
                        ? 'bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-teal-600 text-white' : 
                      isActive ? 'bg-teal-600 text-white' : 'bg-gray-200'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{step.title}</p>
                      <p className="text-xs opacity-75">{step.description}</p>
                      {step.optional && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block">
                          Optional
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Progress Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Form Content */}
        <div className={`${showPreview ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-200 p-8">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                {React.createElement(steps[currentStep].icon, { className: "w-6 h-6 text-teal-600" })}
                <h2 className="text-2xl font-bold text-gray-900">{steps[currentStep].title}</h2>
              </div>
              <p className="text-gray-600">{steps[currentStep].description}</p>
            </div>

            <div className="space-y-6">
              {steps[currentStep].fields.map((field) => (
                <div key={field.id}>
                  {field.type !== 'checkbox' && (
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(field)}
                  {field.helpText && (
                    <p className="text-sm text-gray-500 mt-1">{field.helpText}</p>
                  )}
                  {field.error && (
                    <p className="text-sm text-red-600 mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{field.error}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className={`flex items-center justify-center space-x-2 px-6 min-h-[44px] w-full sm:w-auto rounded-lg transition-colors ${
                  currentStep === 0
                    ? 'text-gray-400 cursor-not-allowed hidden sm:flex'
                    : 'text-gray-700 hover:bg-gray-100 bg-white border border-gray-200 sm:border-transparent'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={handleSave}
                  className="flex justify-center items-center px-6 min-h-[44px] w-full sm:w-auto border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white font-medium text-[14px]"
                >
                  Save Draft
                </button>
                
                {isLastStep ? (
                  <button
                    onClick={() => onSubmit(formData)}
                    disabled={!canProceed}
                    className={`flex items-center justify-center space-x-2 px-6 min-h-[44px] w-full sm:w-auto rounded-lg transition-colors font-medium text-[14px] ${
                      canProceed
                        ? 'bg-teal-600 text-white hover:bg-teal-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Submit Application</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                    disabled={!canProceed}
                    className={`flex items-center justify-center space-x-2 px-6 min-h-[44px] w-full sm:w-auto rounded-lg transition-colors font-medium text-[14px] ${
                      canProceed
                        ? 'bg-teal-600 text-white hover:bg-teal-700'
                        : 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Application Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                {Object.entries(formData).map(([key, value]) => {
                  if (!value) return null;
                  const field = steps.flatMap(s => s.fields).find(f => f.id === key);
                  if (!field) return null;
                  
                  return (
                    <div key={key} className="border-b border-gray-200 pb-2">
                      <p className="font-medium text-gray-700">{field.label}</p>
                      <p className="text-gray-600">
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                         typeof value === 'object' ? value.name || 'File uploaded' :
                         value.toString()}
                      </p>
                    </div>
                  );
                })}
                
                {Object.keys(formData).length === 0 && (
                  <p className="text-gray-500 italic">Start filling out the form to see a preview</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}