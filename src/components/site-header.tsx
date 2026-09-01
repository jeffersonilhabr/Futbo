import { Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, Bot, ListChecks, LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/60">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-auto flex items-center gap-2 font-display text-2xl">
          <BarChart3 className="h-5 w-5 text-primary" /> Placar Analítico
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/robo">
            <Bot className="h-4 w-4" /> Pedir ao robô
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/palpites">
            <ListChecks className="h-4 w-4" /> Meus palpites
          </Link>
        </Button>
        {user ? (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">
              <LogIn className="h-4 w-4" /> Entrar
            </Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
