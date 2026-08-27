import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the team building school software for Nigeria. See open positions at Suibing IT Services, based in Kano.",
  openGraph: {
    title: "Careers | SUIBING IT Services",
    description: "Build software that reaches real classrooms. See our open positions.",
  },
  alternates: { canonical: "/careers" },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
