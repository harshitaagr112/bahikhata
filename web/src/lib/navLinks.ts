import {
  BookOpenText,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Shared by the sidebar (Nav.tsx) and the global "1".."5" keyboard
 * shortcuts (KeyboardShortcuts.tsx) so the two can never drift apart. */
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daybook", label: "Daybook", icon: BookOpenText },
  { href: "/ledgers", label: "Ledgers", icon: Users },
  { href: "/outstanding", label: "Outstanding", icon: ListChecks },
  { href: "/insurance", label: "Insurance", icon: ShieldCheck },
];
