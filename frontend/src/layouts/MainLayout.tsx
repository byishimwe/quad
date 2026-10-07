import { Link, Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { Sidebar } from "../components/layout/Sidebar";
import { RightPanel } from "../components/layout/RightPanel";
import { useAuthStore } from "@/stores/authStore";
import { MainAppSkeleton } from "@/components/ui/loading";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MobileMoreMenu } from "../components/layout/MobileMoreMenu";
import {
  PiHouseBold,
  PiChartBarBold,
  PiBookOpenTextBold,
  PiChatCircleBold,
} from "react-icons/pi";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const { isLoading } = useAuthStore();
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  const isChatRoute =
    location.pathname === "/chat" ||
    location.pathname.startsWith("/chat/");

  if (isLoading) {
    return <MainAppSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Skip Links for Keyboard Navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
        tabIndex={0}>
        Skip to main content
      </a>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <Navbar />
      </div>

      {/* Desktop Layout */}
      <div className="flex">
        {/* Left Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-40">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:pl-64 xl:pr-80 min-w-0">
          <div className="max-w-4xl mx-auto min-w-0">
            <main
              id="main-content"
              className={
                isChatRoute
                  ? "p-0 h-[calc(100dvh-8rem)] lg:h-screen overflow-hidden"
                  : "px-3 py-4 sm:px-6 sm:py-6 lg:px-8 pb-20 lg:pb-6"
              }
              tabIndex={-1}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  className={isChatRoute ? "h-full" : undefined}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
                  transition={{ duration: reducedMotion ? 0 : 0.15, ease: "easeOut" }}>
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Right Panel */}
        <div className="hidden xl:flex xl:w-80 xl:flex-col xl:fixed xl:right-0 xl:inset-y-0 z-40">
          <RightPanel />
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}

export function MobileBottomNav() {
  const location = useLocation();

  const navItems = [
    { href: "/", icon: PiHouseBold, label: "Home" },
    { href: "/polls", icon: PiChartBarBold, label: "Polls" },
    { href: "/stories", icon: PiBookOpenTextBold, label: "Stories" },
    { href: "/chat", icon: PiChatCircleBold, label: "Chat" },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/60 safe-area-pb"
      aria-label="Mobile navigation">
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors duration-150",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}>
              <span className="relative">
                <Icon
                  className={cn(
                    "h-[22px] w-[22px] transition-all duration-150",
                    isActive ? "scale-110" : "",
                  )}
                  aria-hidden="true"
                />
              </span>
              <span className="leading-none">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </Link>
          );
        })}

        {/* More Menu */}
        <MobileMoreMenu />
      </div>
    </nav>
  );
}

