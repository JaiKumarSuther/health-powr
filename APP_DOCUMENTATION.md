# HealthPowr Application Documentation

## Project Overview
**HealthPowr** is a state-of-the-art community health and social services platform. It serves as a bridge between community members in need and organizations (CBOs) that provide essential services like housing, food, healthcare, and job training.

The application is built with a focus on security, accessibility, and real-time communication, featuring dedicated portals for different stakeholders.

---

## Technical Stack
- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS for responsive and modern UI
- **Build Tool**: Vite
- **Database & Auth**: Supabase (PostgreSQL, Realtime, Auth, Storage)
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Maps**: Leaflet & OpenStreetMap (for service discovery)
- **Deployment**: Vercel/Netlify optimized

---

## Core Architecture

### 1. Routing & Authentication
- **`src/App.tsx`**: The main entry point that defines all routes and handles role-based access control.
- **`src/routes/RequireAuth.tsx`**: A wrapper component that protects routes based on user roles (`community_member`, `organization`, `admin`).
- **`src/contexts/AuthContext.tsx`**: Manages the global authentication state, session persistence, and user role resolution.

### 2. State Management
- **`src/contexts/NotificationContext.tsx`**: Provides a global toast notification system for user feedback.
- **React Query**: Used for efficient server-state management, caching, and background synchronization of data like services and applications.

---

## Portal Breakdown & Component Purposes

### A. Client Portal (`src/components/client`)
Designed for community members to find and apply for help.
- **`ClientDashboard.tsx`**: Main layout for the client area, integrating the sidebar and header.
- **`CommunityView.tsx`**: A social/forum space for community members to interact.
- **`MapView.tsx`**: Interactive map for discovering nearby CBOs and service locations.
- **`ServicesView.tsx`**: List view of available services with advanced filtering (borough, category).
- **`ApplicationsView.tsx`**: Tracks the status of service requests submitted by the user.
- **`MessagesView.tsx`**: Real-time chat interface for communicating with CBO staff.
- **`ApplicationForm.tsx` / `ApplyForServiceModal.tsx`**: Complex multi-step forms for applying to specific programs.

### B. CBO (Organization) Portal (`src/components/cbo`)
Designed for organizations to manage their presence and help clients.
- **`CBODashboard.tsx`**: Central hub for organization administrators.
- **`CBOOverview.tsx`**: Dashboard with statistics on applications, active cases, and pending tasks.
- **`ServicesView.tsx`**: Interface for CBOs to list and manage their service offerings.
- **`ClientsView.tsx`**: A CRM-like view of all community members interacting with the organization.
- **`CBOMessagesView.tsx`**: High-volume messaging interface for handling multiple client inquiries.
- **`SettingsView.tsx`**: Manages organization profile, hours of operation, and contact details.

### C. Staff Portal (`src/components/staff`)
A streamlined version for organization employees focused on case management.
- **`StaffDashboard.tsx`**: Main navigation for staff members.
- **`StaffOverview.tsx`**: Daily tasks and assigned service requests.
- **`StaffMessagesView.tsx`**: Messaging focused on assigned cases.

### D. Admin Portal (`src/components/admin`)
For platform owners to manage the entire ecosystem.
- **`AdminDashboard.tsx`**: System-level navigation.
- **`AdminOverviewView.tsx`**: Global metrics (active users, total organizations, successful placements).
- **`OrganizationsListView.tsx`**: Manage organization approvals and platform participation.
- **`UsersListView.tsx`**: User account management and role assignment.
- **`AdminAnnouncementsView.tsx`**: Tool to broadcast system-wide updates.

---

## Support Directories

### Hooks (`src/hooks`)
- **`useGeolocation.ts`**: Handles browser location permissions and provides current coordinates for the map.
- **`useServices.ts`**: Encapsulates data fetching logic for service listings.
- **`useOrganizations.ts`**: Fetches CBO data for the directory and admin views.

### Library & Utilities (`src/lib`)
- **`supabase.ts`**: Initializes the Supabase client.
- **`types.ts`**: Centralized TypeScript interfaces for all data models (Profiles, Organizations, ServiceRequests, etc.).
- **`utils.ts`**: Common utility functions (formatting, validation).
- **`organzationsApi.ts`**: Specific API helpers for organization-related operations.

### UI Components (`src/components/ui`)
Generic, reusable UI elements built for consistency:
- Buttons, Inputs, Dialogs (Modals), Tabs, Cards, and Badges.

---

## Backend Infrastructure (Supabase)

### Database Schema (`supabase/migrations`)
The database is structured to support complex relationships:
- **`profiles`**: Stores user data and roles.
- **`organizations`**: Stores CBO details and location data.
- **`services`**: Stores the actual programs offered by CBOs.
- **`service_requests`**: Stores applications submitted by clients.
- **`messages` / `conversations`**: Powers the real-time chat system.

### Serverless Logic (`supabase/functions`)
Edge functions handle sensitive operations:
- **`setup-organization`**: Bootstraps new CBO accounts.
- **Email notifications**: Sends alerts for new messages or status updates.

---

## Summary of File Responsibilities

| File/Directory | Responsibility |
| :--- | :--- |
| `src/main.tsx` | App hydration and provider setup. |
| `src/App.tsx` | Central Routing and Guarding. |
| `src/pages/AuthPage.tsx` | Unified Sign-in/Sign-up for all users. |
| `src/components/landing/*` | Public marketing and educational content. |
| `src/components/shared/*` | Layout elements used across portals (Header, Footer). |
| `src/lib/orgSlug.ts` | Utilities for dynamic organization URL routing. |

---

## Detailed Component Index

### Client Portal (`src/components/client/`)
- **`ApplicationForm.tsx`**: The primary form container for service applications.
- **`ApplicationFormContent.tsx`**: The internal layout and logic for the multi-step application process.
- **`ApplicationFormSheet.tsx`**: A slide-over (Sheet) wrapper for the application form.
- **`ApplicationsView.tsx`**: A dashboard view showing a user's active and past service requests.
- **`ApplyForServiceModal.tsx`**: A modal dialog for starting a new application.
- **`ClientDashboard.tsx`**: The shell component for the client experience.
- **`ClientHeader.tsx`**: Responsive navigation bar with notifications and user profile menu.
- **`ClientSidebar.tsx`**: Side navigation for quick access to Map, Services, and Messages.
- **`CommunityView.tsx`**: A forum/bulletin board for community updates and interaction.
- **`EmergencyResourcesView.tsx`**: Quick-access view for urgent help (hotlines, shelters).
- **`MapView.tsx`**: Geographical exploration of services using Leaflet.
- **`MessagesView.tsx`**: Chat interface for client-to-organization communication.
- **`ServiceCard.tsx`**: Reusable card component for displaying service highlights.
- **`ServicesView.tsx`**: Searchable and filterable directory of available programs.

### CBO Portal (`src/components/cbo/`)
- **`CBODashboard.tsx`**: Root component for the organization management portal.
- **`CBOHeader.tsx` / `CBOSidebar.tsx`**: Navigation components tailored for CBO admins.
- **`CBOMessagesView.tsx`**: Unified inbox for organization staff.
- **`CBOOverview.tsx`**: Analytical dashboard with key performance indicators.
- **`CBOReports.tsx`**: Data export and visualization tools.
- **`ClientsView.tsx`**: Directory of clients who have interacted with the organization.
- **`CreateServicePage.tsx`**: Specialized form for organizations to post new service offerings.
- **`ServiceDetailPage.tsx`**: Comprehensive view of a specific service with performance metrics.
- **`SettingsView.tsx`**: Organization profile and operational settings management.

### Admin Portal (`src/components/admin/`)
- **`AdminDashboard.tsx`**: The entry point for platform administrators.
- **`AdminOverviewView.tsx`**: High-level platform health monitoring.
- **`AdminAnnouncementsView.tsx`**: Interface for managing system-wide alerts.
- **`OrganizationsListView.tsx`**: Master list for vetting and managing participating CBOs.
- **`UsersListView.tsx`**: User account management across all roles.
- **`OrgDetailsPage.tsx`**: Deep-dive view into a specific CBO's activity and status.
- **`RequestsListView.tsx`**: Global view of all service requests across the platform.

### Shared & UI Components (`src/components/ui/` & `src/components/shared/`)
- **`ui/button.tsx`**: Custom styled buttons with various variants (primary, outline, ghost).
- **`ui/dialog.tsx`**: Base modal component using Radix UI primitives.
- **`shared/LoadingSpinner.tsx`**: Consistent loading state indicator used during data fetching.
- **`shared/ConfigurationError.tsx`**: User-friendly error page for environment misconfigurations.

