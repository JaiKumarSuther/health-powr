import { Shield } from "lucide-react";
import { AccountSettingsView } from "../shared/AccountSettingsView";

export function AdminSettingsView() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
            <Shield className="h-5 w-5 text-teal-700" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              Admin Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Update your name, profile photo, and password.
            </p>
          </div>
        </div>
      </div>

      <AccountSettingsView hideBorough />
    </div>
  );
}

