export function ConfigurationError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <h1 className="text-lg font-bold text-gray-900">Configuration error</h1>
        <p className="text-sm text-gray-600 mt-2">
          This app is missing required environment variables. Set{" "}
          <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
          <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>.
        </p>
      </div>
    </div>
  );
}

