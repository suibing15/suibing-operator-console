"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, isConfigured } from "@/lib/supabaseClient";

type AuthCtx = { email: string | null; isOperator: boolean; loading: boolean; signOut: () => void };
const Ctx = createContext<AuthCtx>({ email: null, isOperator: false, loading: true, signOut: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [isOperator, setIsOperator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      const e = data.session?.user?.email ?? null;
      setEmail(e);
      if (e) {
        const { data: op } = await supabase.from("operators").select("email").eq("email", e).maybeSingle();
        setIsOperator(!!op);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const e = session?.user?.email ?? null;
      setEmail(e);
      if (e) {
        const { data: op } = await supabase.from("operators").select("email").eq("email", e).maybeSingle();
        setIsOperator(!!op);
      } else setIsOperator(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function signOut() { supabase.auth.signOut(); }
  return <Ctx.Provider value={{ email, isOperator, loading, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
