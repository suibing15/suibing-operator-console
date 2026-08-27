import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply for a Service",
  description:
    "Apply for SUIBING Bucket, SSMS, SuibingLedger, E-Examiner, or custom software development. Get started with Suibing IT Services today.",
  openGraph: {
    title: "Apply for a Service | SUIBING IT Services",
    description: "Tell us what you need — records, examinations, fees, or custom development. We'll review and get back to you.",
  },
  alternates: { canonical: "/apply" },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
