import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Layout/Header";
import { Trash2, Plus, ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Torre {
  nome_torre: string;
}

export const EditTorres = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [torres, setTorres] = useState<Torre[]>([]);
  const [newTorreName, setNewTorreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTorres = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/dados/torres-atendimento`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setTorres(response.data);
      } catch (err) {
        console.error("Erro ao buscar torres:", err);
        setError("Não foi possível carregar as torres de atendimento.");
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchTorres();
  }, [toast]);

  const removeTorre = (nome: string) => {
    setTorres(torres.filter(torre => torre.nome_torre !== nome));
  };

  const handleUpdateTorre = (index: number, value: string) => {
    const updated = [...torres];
    updated[index].nome_torre = value;
    setTorres(updated);
  };

  const addTorre = () => {
    if (newTorreName && newTorreName.trim()) {
      if (torres.some(t => t.nome_torre.toLowerCase() === newTorreName.trim().toLowerCase())) {
        toast({ title: "Torre já existe", description: "Essa torre de atendimento já está na lista.", variant: "destructive" });
        return;
      }
      const novaTorre: Torre = {
        nome_torre: newTorreName.trim()
      };
      setTorres([...torres, novaTorre]);
      setNewTorreName(""); // Clear input after adding
    }
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      await axios.put(`${import.meta.env.VITE_API_URL}/atualizar-torres-atendimento`, torres, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast({ title: "Sucesso!", description: "A lista de torres foi atualizada." });
      navigate("/dados");
    } catch (err) {
      console.error("Erro ao salvar torres:", err);
      toast({ title: "Erro ao salvar", description: "Não foi possível atualizar as torres.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">{error}</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold">Editar Torres de Atendimento</h1>
              <p className="text-muted-foreground">Gerencie as torres disponíveis no sistema.</p>
            </div>
          </div>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Adicionar Nova Torre</CardTitle>
              <div className="flex gap-2 pt-4">
                <Input 
                  value={newTorreName} 
                  onChange={(e) => setNewTorreName(e.target.value)}
                  placeholder="Nome da nova torre"
                />
                <Button onClick={addTorre}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 border-y font-semibold">
                <div>Nome da Torre</div>
                <div className="text-center">Ação</div>
              </div>
              <div className="divide-y">
                {torres.map((torre, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4 p-4 items-center">
                    <Input
                      value={torre.nome_torre}
                      onChange={(e) => handleUpdateTorre(index, e.target.value)}
                    />
                    <div className="flex justify-center">
                      <Button onClick={() => removeTorre(torre.nome_torre)} variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {torres.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <p>Nenhuma torre de atendimento cadastrada.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate("/dados")} size="lg" variant="outline">Cancelar</Button>
            <Button onClick={handleSave} size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
