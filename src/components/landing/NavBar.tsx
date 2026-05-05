import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { BrandMark } from "./BrandMark";

export function NavBar({
  onSignIn,
  onJoin,
}: {
  onSignIn: () => void;
  onJoin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleScrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 400);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-gray-100 bg-white/80 backdrop-blur-md shadow-sm"
          : "border-b border-transparent bg-white"
      }`}
    >
      <div id="top" />
      <div className="mx-auto flex w-full max-w-[1560px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="h-10 w-10" />
          <span className="text-[18px] font-extrabold tracking-tight text-slate-900">
            <span className="text-teal-600">Health</span>
            <span className="text-emerald-500">Powr</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-9 text-sm font-semibold text-slate-600 md:flex">
          <a
            className="hover:text-teal-600"
            href="#how-it-works"
            onClick={(e) => handleScrollTo(e, "how-it-works")}
          >
            How it works
          </a>
          <a
            className="hover:text-teal-600"
            href="#for-organizations"
            onClick={(e) => handleScrollTo(e, "for-organizations")}
          >
            For organizations
          </a>
          <a
            className="hover:text-teal-600"
            href="#mission"
            onClick={(e) => handleScrollTo(e, "mission")}
          >
            Mission
          </a>
          <a
            className="hover:text-teal-600"
            href="mailto:mardoche@healthpowr.com"
          >
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-700 transition hover:border-teal-200 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Sign in — ghost style */}
          <button
            onClick={() => {
              setOpen(false);
              onSignIn();
            }}
            className="hidden text-sm font-semibold text-slate-700 hover:text-teal-600 transition-colors px-4 py-2 md:inline-flex"
          >
            Sign in
          </button>

          {/* Get started — primary pill */}
          <button
            onClick={() => {
              setOpen(false);
              onJoin();
            }}
            className="hidden bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-full px-5 py-2.5 transition-colors md:inline-flex"
          >
            Get started
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="mx-auto w-full max-w-[1560px] px-4 py-4">
            <div className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <a
                className="rounded-xl px-3 py-3 hover:bg-teal-50 hover:text-teal-800"
                href="#how-it-works"
                onClick={(e) => handleScrollTo(e, "how-it-works")}
              >
                How it works
              </a>
              <a
                className="rounded-xl px-3 py-3 hover:bg-teal-50 hover:text-teal-800"
                href="#for-organizations"
                onClick={(e) => handleScrollTo(e, "for-organizations")}
              >
                For organizations
              </a>
              <a
                className="rounded-xl px-3 py-3 hover:bg-teal-50 hover:text-teal-800"
                href="#mission"
                onClick={(e) => handleScrollTo(e, "mission")}
              >
                Mission
              </a>
              <a
                className="rounded-xl px-3 py-3 hover:bg-teal-50 hover:text-teal-800"
                href="mailto:mardoche@healthpowr.com"
              >
                Contact
              </a>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    onSignIn();
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-extrabold text-slate-900 transition hover:border-teal-200 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
                >
                  Sign in
                </button>
              </div>
              <div>
                <button
                  onClick={() => {
                    setOpen(false);
                    onJoin();
                  }}
                  className="w-full rounded-xl bg-teal-600 px-4 py-3 font-extrabold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Get started
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

