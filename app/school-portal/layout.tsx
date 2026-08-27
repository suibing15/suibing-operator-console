import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "School Portal",
  description: "Sign in to your school's private portal to view invoices, submit payments, and track activity.",
  robots: { index: false, follow: false }, // authenticated portal, not useful in search results
};

export default function SchoolPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
