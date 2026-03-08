import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Layout/Header";
import { Trash2, Plus, ArrowLeft, Save, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Input } from "@/components/ui/input";

interface Certificacao {
  fornecedor: string;
  certificacao: string;
}

export const EditCertificacoes = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [certificacoes, setCertificacoes] = useState<Certificacao[]>([]);
  const [newCert, setNewCert] = useState<Certificacao>({ fornecedor: "", certificacao: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const authResponse = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (authResponse.data.is_super_admin) {
          setIsAuthorized(true);
          const certResponse = await axios.get(`${import.meta.env.VITE_API_URL}/dados/certificacoes`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setCertificacoes(certResponse.data);
        } else {
          setError("Acesso não autorizado.");
        }
      } catch (err) {
        console.error("Erro na verificação ou busca de dados:", err);
        setError("Ocorreu um erro. Tente fazer login novamente.");
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndFetchData();
  }, []);

  const removeCertificacao = (index: number) => {
    setCertificacoes(certificacoes.filter((_, i) => i !== index));
  };

  const addCertificacao = () => {
    if (newCert.fornecedor.trim() && newCert.certificacao.trim()) {
      if (certificacoes.some(c => c.fornecedor.toLowerCase() === newCert.fornecedor.trim().toLowerCase() && c.certificacao.toLowerCase() === newCert.certificacao.trim().toLowerCase())) {
        toast({ title: "Certificação já existe", variant: "destructive" });
        return;
      }
      setCertificacoes([...certificacoes, newCert]);
      setNewCert({ fornecedor: "", certificacao: "" });
    }
  };
  
  const handleUpdateCertificacao = (index: number, field: keyof Certificacao, value: string) => {
    const updated = [...certificacoes];
    updated[index] = { ...updated[index], [field]: value };
    setCertificacoes(updated);
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      await axios.put(`${import.meta.env.VITE_API_URL}/atualizar-certificacoes`, certificacoes, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast({ title: "Sucesso!", description: "A lista de certificações foi atualizada." });
      navigate("/dados");
    } catch (err) {
      console.error("Erro ao salvar certificações:", err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!isAuthorized) {
    return (
        <div className="min-h-screen bg-gradient-subtle">
            <Header />
            <main className="container mx-auto px-6 py-8 text-center">
                <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
                <p className="text-muted-foreground">Você não tem permissão para ver esta página.</p>
                <Button onClick={() => navigate('/dados')} className="mt-4">Voltar para Meus Dados</Button>
            </main>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold">Editar Certificações</h1>
              <p className="text-muted-foreground">Gerencie as certificações disponíveis no sistema.</p>
            </div>
          </div>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Adicionar Nova Certificação</CardTitle>
              <div className="flex gap-2 pt-4">
                <Input 
                  value={newCert.fornecedor} 
                  onChange={(e) => setNewCert({ ...newCert, fornecedor: e.target.value })}
                  placeholder="Nome do Fornecedor"
                />
                <Input 
                  value={newCert.certificacao} 
                  onChange={(e) => setNewCert({ ...newCert, certificacao: e.target.value })}
                  placeholder="Nome da Certificação"
                />
                <Button onClick={addCertificacao}><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 border-y font-semibold">
                <div>Fornecedor</div>
                <div>Certificação</div>
                <div className="text-center">Ação</div>
              </div>
              <div className="divide-y">
                {certificacoes.map((cert, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4 p-4 items-center">
                    <Input
                      value={cert.fornecedor}
                      onChange={(e) => handleUpdateCertificacao(index, 'fornecedor', e.target.value)}
                    />
                    <Input
                      value={cert.certificacao}
                      onChange={(e) => handleUpdateCertificacao(index, 'certificacao', e.target.value)}
                    />
                    <div className="flex justify-center">
                      <Button onClick={() => removeCertificacao(index)} variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Remover</Button>
                    </div>
                  </div>
                ))}
              </div>
              {certificacoes.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <p>Nenhuma certificação cadastrada.</p>
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
