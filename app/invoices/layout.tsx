import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check Invoices",
  description: "Look up and download invoices issued to your school by Suibing IT Services.",
  robots: { index: false, follow: false }, // account-lookup page, not useful in search results
  alternates: { canonical: "/invoices" },
};

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
