import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { LandingRole } from "./landing";
import {
  CTA,
  FAQ,
  Footer,
  ForOrganizations,
  Hero,
  HowItWorks,
  Messaging,
  NavBar,
  ServicesSheet,
  AuthNudgeModal,
} from "./landing";

export function LandingPage() {
  const { user, profile, isLoading, isResolvingRole, isSubmitting } = useAuth();
  const navigate = useNavigate();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetQuery, setSheetQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [isAuthNudgeOpen, setIsAuthNudgeOpen] = useState(false);

  useEffect(() => {
    if (isLoading || isResolvingRole) return  // wait for confirmed role
    if (isSubmitting) return;
    if (!user) return;
    const role = profile?.role ?? user.role
    if (role === 'admin') navigate('/admin', { replace: true })
    else if (role === 'organization') navigate('/cbo', { replace: true })
    else if (role === 'community_member') navigate('/client', { replace: true })
  }, [user, profile, isLoading, isResolvingRole, isSubmitting, navigate]);

  const openAuth = (role: LandingRole, mode: "signin" | "signup") => {
    // Landing supports community members + organizations.
    navigate(`/auth?mode=${mode}&role=${role}`);
  };

  const handleSearch = (input: { query: string; category?: string }) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "hp_landing_search",
        JSON.stringify({
          query: input.query ?? "",
          category: input.category ?? null,
          at: Date.now(),
        }),
      );
    }
    // If already signed in, take user to their own portal — not always /client.
    if (user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin', { replace: false });
      } else if (profile.role === 'organization') {
        navigate('/cbo', { replace: false });
      } else {
        navigate('/client/services', { replace: false });
      }
      return;
    }
  };

  const handleFindResources = (query: string, category: string | null) => {
    setSheetQuery(query);
    setActiveCategory(category);
    setIsSheetOpen(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-700">
      <NavBar
        onSignIn={() => openAuth("community_member", "signin")}
        onJoin={() => openAuth("community_member", "signup")}
      />

      <Hero
        onFindResources={handleFindResources}
        onSignIn={() => openAuth("community_member", "signin")}
        onJoin={() => openAuth("community_member", "signup")}
      />

      <HowItWorks />
      <Messaging />
      <ForOrganizations onIntro={() => openAuth("organization", "signup")} />
      <FAQ onJoin={() => openAuth("community_member", "signup")} />
      <CTA
        onSearch={handleSearch}
        onFindResources={handleFindResources}
        onIntro={() => openAuth("organization", "signup")}
        onSignIn={() => openAuth("community_member", "signin")}
        onJoin={() => openAuth("community_member", "signup")}
      />
      <Footer />

      <ServicesSheet
        isOpen={isSheetOpen}
        query={sheetQuery}
        initialCategory={activeCategory}
        onClose={() => setIsSheetOpen(false)}
        onRequestNow={(svc) => {
          setSelectedService(svc);
          setIsAuthNudgeOpen(true);
        }}
      />

      <AuthNudgeModal
        isOpen={isAuthNudgeOpen}
        service={
          selectedService
            ? {
                name: selectedService.name,
                orgName: selectedService.organizations?.name ?? "",
                photoUrl: selectedService.organizations?.avatar_url ?? undefined,
                meta: selectedService.organizations?.borough ?? "",
                category: selectedService.category,
              }
            : null
        }
        onClose={() => setIsAuthNudgeOpen(false)}
        onSignUp={() => {
          setIsAuthNudgeOpen(false);
          setIsSheetOpen(false);
          openAuth("community_member", "signup");
        }}
        onSignIn={() => {
          setIsAuthNudgeOpen(false);
          setIsSheetOpen(false);
          openAuth("community_member", "signin");
        }}
      />
    </div>
  );
}