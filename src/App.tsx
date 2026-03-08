import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./pages/Login";
import { UserData } from "./pages/UserData";
import { EditUserData } from "./pages/EditUserData";
import { EditTorres } from "./pages/EditTorres";
import { EditCertificacoes } from "./pages/EditCertificacoes";
import { CriarUsuario } from "./pages/CriarUsuario";
import { RedefinirSenhaUsuario } from "./pages/RedefinirSenhaUsuario";
import { MinhaSenha } from "./pages/MinhaSenha";
import { RelatorioBI } from "./pages/RelatorioBI";
import { EditarOperacoes } from "./pages/EditarOperacoes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dados" element={<UserData />} />
          <Route path="/editar-dados" element={<EditUserData />} />
          <Route path="/editar-torres" element={<EditTorres />} />
          <Route path="/editar-certificacoes" element={<EditCertificacoes />} />
          <Route path="/editar-operacoes" element={<EditarOperacoes />} />
          <Route path="/criar-usuario" element={<CriarUsuario />} />
          <Route path="/redefinir-senha" element={<RedefinirSenhaUsuario />} />
          <Route path="/minha-senha" element={<MinhaSenha />} />
          <Route path="/relatorio-bi" element={<RelatorioBI />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;