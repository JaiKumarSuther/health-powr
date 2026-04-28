import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Don't refetch just because a component remounted.
      // We explicitly invalidate queries after mutations.
      refetchOnMount: false,
      retry: 1,
      // Treat data as fresh for a while so tab/page changes don't refetch.
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep cached data around so returning to a tab is instant.
      gcTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
