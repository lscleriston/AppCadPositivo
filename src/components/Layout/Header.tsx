import { User, LogOut, Settings, Home, Edit, Building2, Award, KeyRound, SlidersHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { useCurrentUser } from "@/hooks/use-current-user";

interface HeaderProps {
}

export const Header = () => {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { isSuperAdmin } = useIsSuperAdmin();
  const { currentUser, loading, error } = useCurrentUser();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/');
  };

  if (loading) {
    return null; // Or a loading spinner if preferred
  }

  if (error) {
    console.error("Error loading user for header:", error);
    return null; // Or an error message
  }

  return (
    <header className="bg-white text-gray-800 shadow-elegant border-b">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <img src="/logo.svg" alt="Logo Positivo" className="h-5 cursor-pointer" onClick={() => navigate('/dados')} />

          <nav className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" onClick={() => navigate('/dados')}><Home className="h-4 w-4 mr-2"/>Meus Dados</Button>
            <Button variant="ghost" onClick={() => navigate('/editar-dados')}><Edit className="h-4 w-4 mr-2"/>Editar Dados</Button>
            {isSuperAdmin && (
              <>
                <Button variant="ghost" onClick={() => navigate('/editar-torres')}><Building2 className="h-4 w-4 mr-2"/>Editar Torres</Button>
                <Button variant="ghost" onClick={() => navigate('/editar-operacoes')}><SlidersHorizontal className="h-4 w-4 mr-2"/>Editar Operações</Button>
                <Button variant="ghost" onClick={() => navigate('/editar-certificacoes')}><Award className="h-4 w-4 mr-2"/>Editar Certificações</Button>
              </>
            )}

          </nav>

          <div className="flex items-center space-x-4">
            <span className="hidden md:block text-sm">Bem vindo, {currentUser?.nome}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-gray-200 text-gray-800">{currentUser?.nome?.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser?.nome}</p>
                    <p className="text-xs leading-none text-muted-foreground">{currentUser?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/criar-usuario')}><User className="mr-2 h-4 w-4" />Criar Usuário</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/gerenciar-usuarios')}><Users className="mr-2 h-4 w-4" />Gerenciar Usuários</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/redefinir-senha')}><KeyRound className="mr-2 h-4 w-4" />Redefinir Senha</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate('/minha-senha')}><Settings className="mr-2 h-4 w-4" />Minha Senha</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};