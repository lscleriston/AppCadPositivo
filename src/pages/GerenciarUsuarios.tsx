import { useEffect, useState } from "react";
import axios from "axios";
import { Header } from "@/components/Layout/Header";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Save, UserX } from "lucide-react";

type UsuarioAdmin = {
  id: number;
  matricula: string;
  nome?: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  is_active: boolean;
  dados_completos: boolean;
  ultima_alteracao_por_matricula?: string | null;
};

export const GerenciarUsuarios = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: loadingAdmin } = useIsAdmin();
  const { toast } = useToast();

  const [loadingRole, setLoadingRole] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [query, setQuery] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [resultados, setResultados] = useState<UsuarioAdmin[]>([]);

  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selecionado, setSelecionado] = useState<UsuarioAdmin | null>(null);

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsSuperAdmin(Boolean(response.data?.is_super_admin));
      } catch (error) {
        console.error("Erro ao carregar perfil atual:", error);
      } finally {
        setLoadingRole(false);
      }
    };

    carregarPerfil();
  }, []);

  const buscarUsuarios = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    setLoadingSearch(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/usuarios/buscar`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query, limit: 50 },
      });

      setResultados(response.data || []);
      if (!response.data?.length) {
        toast({
          title: "Nenhum usuário encontrado",
          description: "Tente buscar por matrícula ou nome.",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast({
        variant: "destructive",
        title: "Erro na busca",
        description: "Não foi possível buscar usuários agora.",
      });
    } finally {
      setLoadingSearch(false);
    }
  };

  const carregarUsuario = async (userId: number) => {
    setLoadingDetalhes(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/usuarios/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelecionado(response.data);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar usuário",
        description: "Não foi possível carregar os detalhes para edição.",
      });
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const salvarAlteracoes = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selecionado) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const payload = {
        nome: selecionado.nome || null,
        is_admin: selecionado.is_admin,
        is_super_admin: selecionado.is_super_admin,
        is_active: selecionado.is_active,
      };

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/usuarios/${selecionado.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const atualizado = response.data as UsuarioAdmin;
      setSelecionado(atualizado);
      setResultados((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));

      toast({
        title: "Usuário atualizado",
        description: "As informações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingAdmin || loadingRole) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando permissões...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <div className="flex flex-col items-center justify-center text-center py-20">
          <UserX className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8 space-y-6">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Gerenciar Usuários</CardTitle>
            <CardDescription>
              Busque por matrícula ou nome, visualize os dados e atualize permissões/status ativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={buscarUsuarios} className="flex gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite matrícula ou nome"
              />
              <Button type="submit" disabled={loadingSearch}>
                {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>{resultados.length} usuário(s) encontrado(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[520px] overflow-auto">
              {resultados.map((usuario) => (
                <div key={usuario.id} className="rounded-md border p-3 space-y-3">
                  <button
                    type="button"
                    className={`w-full text-left transition rounded-md p-2 ${selecionado?.id === usuario.id ? "border border-primary bg-primary/5" : "hover:bg-muted"}`}
                    onClick={() => carregarUsuario(usuario.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{usuario.nome || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">Matrícula: {usuario.matricula}</p>
                      </div>
                      <Badge variant={usuario.is_active ? "default" : "destructive"}>
                        {usuario.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/editar-dados?matricula=${encodeURIComponent(usuario.matricula)}`)}
                  >
                    Editar Dados Completos e Arquivos
                  </Button>
                </div>
              ))}

              {!resultados.length && (
                <p className="text-sm text-muted-foreground">Faça uma busca para listar usuários.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Editar Usuário</CardTitle>
              <CardDescription>
                {selecionado ? `Editando matrícula ${selecionado.matricula}` : "Selecione um usuário para editar."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetalhes && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando detalhes...
                </div>
              )}

              {!loadingDetalhes && selecionado && (
                <form onSubmit={salvarAlteracoes} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input value={selecionado.matricula} disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={selecionado.nome || ""}
                      onChange={(e) => setSelecionado({ ...selecionado, nome: e.target.value })}
                      placeholder="Nome do usuário"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Última alteração por (login)</Label>
                    <Input value={selecionado.ultima_alteracao_por_matricula || "Sem registro"} disabled />
                  </div>

                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selecionado.is_admin}
                        onCheckedChange={(checked) => setSelecionado({ ...selecionado, is_admin: Boolean(checked) })}
                      />
                      <Label>Administrador</Label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selecionado.is_super_admin}
                        disabled={!isSuperAdmin}
                        onCheckedChange={(checked) => setSelecionado({ ...selecionado, is_super_admin: Boolean(checked) })}
                      />
                      <Label>Super Administrador</Label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selecionado.is_active}
                        onCheckedChange={(checked) => setSelecionado({ ...selecionado, is_active: Boolean(checked) })}
                      />
                      <Label>Usuário Ativo</Label>
                    </div>
                  </div>

                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Alterações
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/editar-dados?matricula=${encodeURIComponent(selecionado.matricula)}`)}
                  >
                    Editar Dados Completos e Arquivos
                  </Button>
                </form>
              )}

              {!loadingDetalhes && !selecionado && (
                <p className="text-sm text-muted-foreground">Selecione um usuário na lista para editar aqui, ou use o botão "Editar Dados Completos e Arquivos" direto no resultado da busca.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
