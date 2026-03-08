import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/Layout/Header";
import { Eye, Calendar, User, MapPin, Briefcase, Award, BookOpen, Loader2, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { useToast } from "@/components/ui/use-toast";

interface UserData {
  matricula: string;
  nome_completo: string;
  torre_atendimento: string;
  conhecimento: string[];
  operacao_principal: string;
  operacao_compartilhada: string[];
  certificacoes: string[];
  emissao_certificacoes: string[];
  validade_certificacoes: string[];
  diploma_superior: string[];
  conclusao_superior?: string;
  pos_graduacao: string[];
  conclusao_pos?: string;
  curriculo_atualizado?: string;
  cursos: string[];
  url_linkedin?: string;
  ultima_atualizacao: string;
}

const DataItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-4 items-start">
    <span className="font-medium text-muted-foreground">{label}:</span>
    <div className="col-span-2 font-semibold text-foreground">{value}</div>
  </div>
);

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  // Add a day to counteract timezone issues that might push the date back
  date.setDate(date.getDate() + 1);
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

// Limpar nome (remover caracteres especiais) - mesmo padrão do backend
const limparNome = (nome: string): string => {
  return nome.replace(/[^\w\-]/g, '_');
};

// Helper para gerar URL de arquivo com token embutido via data-uri ou link proxy
const getFileLink = (fileUrl: string, token: string | null): string => {
  // Retorna URL com token como query param (requer backend CORS ou POST)
  // Alternativamente, usamos um link direto que o fetch no onClick vai resolver
  return fileUrl;
};

// Helper para fazer download/abrir arquivo com autenticação
const handleFileClick = async (e: React.MouseEvent<HTMLAnchorElement>, fileUrl: string, fileName: string) => {
  e.preventDefault();
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    alert('Token de autenticação não encontrado');
    return;
  }

  try {
    const response = await axios.get(fileUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      responseType: 'blob',
      withCredentials: true
    });

    // Criar blob URL e disparar download
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Erro ao baixar arquivo:', err);
    alert('Erro ao abrir/baixar arquivo');
  }
};

export const UserData = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graduacaoArquivos, setGraduacaoArquivos] = useState<Record<string, string[]>>({});
  const [curriculoArquivos, setCurriculoArquivos] = useState<string[]>([]);
  const [certificacaoArquivos, setCertificacaoArquivos] = useState<Record<string, { fornecedor: string; arquivos: string[] }>>({});

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/dados/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setUserData(response.data);

        // tenta buscar arquivos de graduação, currículo e certificações
        try {
          const [gradResp, currResp] = await Promise.all([
            axios.get(`${import.meta.env.VITE_API_URL}/dados/nome-arquivo-graduacao`, {
              headers: { 'Authorization': `Bearer ${token}` }
            }),
            axios.get(`${import.meta.env.VITE_API_URL}/dados/nome-arquivo-curriculo`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          ]);
          // A API retorna { arquivos: { diploma: [files] } }
          const payload = gradResp.data.arquivos || {};
          setGraduacaoArquivos(payload as Record<string, string[]>);
          
          // currículo: { arquivos: [files] }
          const currFiles = currResp.data.arquivos || [];
          setCurriculoArquivos(currFiles as string[]);

          // Para cada certificação, buscar arquivos
          if (response.data.certificacoes && response.data.certificacoes.length > 0) {
            const certMap: Record<string, { fornecedor: string; arquivos: string[] }> = {};
            // Nota: a API retorna apenas nomes de certificações, não fornecedor
            // Precisamos coletar todas as certificações disponíveis primeiro
            try {
              const headers = { 'Authorization': `Bearer ${token}` };
              const allCertsResp = await axios.get(`${import.meta.env.VITE_API_URL}/dados/certificacoes`, { headers });
              const allCerts = allCertsResp.data || [];
              
              for (const certName of response.data.certificacoes) {
                const certInfo = allCerts.find((c: any) => c.certificacao === certName);
                if (certInfo) {
                  try {
                    const fileResp = await axios.get(
                      `${import.meta.env.VITE_API_URL}/dados/nome-arquivo-certificacao`,
                      {
                        headers,
                        params: { fornecedor: certInfo.fornecedor, certificacao: certName }
                      }
                    );
                    if (fileResp.data.arquivos && fileResp.data.arquivos.length > 0) {
                      certMap[certName] = {
                        fornecedor: certInfo.fornecedor,
                        arquivos: fileResp.data.arquivos
                      };
                    }
                  } catch (e) {
                    console.log(`Erro ao buscar arquivos para cert ${certName}:`, e);
                  }
                }
              }
            } catch (e) {
              console.log('Erro ao buscar informações de certificações:', e);
            }
            setCertificacaoArquivos(certMap);
          }
        } catch (e) {
          console.log('Erro ao buscar arquivos:', e);
        }
      } catch (err) {
        console.error("Erro ao buscar dados:", err);
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          // If data is not found, redirect to edit page
          
          toast({ variant: "destructive", title: "Dados Incompletos", description: "Por favor, complete seus dados para visualizar seu perfil." });
          navigate("/editar-dados");
        } else {
          setError("Erro ao carregar dados do usuário");
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os dados." });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-lg mb-4">{error || "Erro ao carregar dados"}</p>
          <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Seus Dados</h1>
            <p className="text-muted-foreground">Visualize suas informações pessoais e profissionais.</p>
          </div>

          <Card className="shadow-elegant">
            <CardHeader className="bg-gradient-subtle border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl"><User className="h-6 w-6 text-primary" />Informações Gerais</CardTitle>
                <Button variant="outline" onClick={() => navigate("/editar-dados")}><Edit className="h-4 w-4 mr-2" />Editar</Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <DataItem label="Matrícula" value={userData.matricula} />
              <DataItem label="Nome Completo" value={userData.nome_completo} />
              <DataItem label="LinkedIn" value={userData.url_linkedin ? <a href={userData.url_linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{userData.url_linkedin}</a> : 'N/A'} />
              <DataItem label="Torre de Atendimento" value={<Badge variant="secondary">{userData.torre_atendimento}</Badge>} />
              <DataItem label="Operação Principal" value={<Badge variant="outline">{userData.operacao_principal}</Badge>} />
              <DataItem label="Operações Compartilhadas" value={<div className="flex flex-wrap gap-2">{userData.operacao_compartilhada.map(op => <Badge key={op}>{op}</Badge>)}</div>} />
              <DataItem label="Conhecimentos" value={<div className="flex flex-wrap gap-2">{userData.conhecimento.map(c => <Badge key={c} variant="default">{c}</Badge>)}</div>} />
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader><CardTitle className="flex items-center gap-3"><Award className="h-5 w-5 text-secondary" />Certificações</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              {userData.certificacoes && userData.certificacoes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userData.certificacoes.map((cert, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-background/50 space-y-2">
                      <p className="font-semibold text-primary">{cert}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Emissão:</strong> {formatDate(userData.emissao_certificacoes?.[index])}</p>
                        <p><strong>Validade:</strong> {formatDate(userData.validade_certificacoes?.[index])}</p>
                      </div>
                      {certificacaoArquivos[cert]?.arquivos && certificacaoArquivos[cert].arquivos.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs font-medium mb-1">Arquivos:</div>
                          <ul className="space-y-1">
                            {certificacaoArquivos[cert].arquivos.map((arq, idx) => {
                              const nomeUsuario = limparNome(userData.nome_completo);
                              const fornecedor = limparNome(certificacaoArquivos[cert].fornecedor);
                              const certClean = limparNome(cert);
                              const link = `${import.meta.env.VITE_API_URL}/ver-certificacao/${nomeUsuario}/${fornecedor}/${certClean}/${arq}`;
                              return (
                                <li key={idx}>
                                  <a href={link} onClick={(e) => handleFileClick(e, link, arq)} className="text-blue-500 hover:underline text-xs cursor-pointer">{arq}</a>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhuma certificação cadastrada.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader><CardTitle className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-warning" />Formação e Cursos</CardTitle></CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold">Formação Acadêmica</h3>
                <DataItem label="Superior" value={(userData.diploma_superior || []).join(', ') || 'N/A'} />
                
                {/* Currículo */}
                {curriculoArquivos.length > 0 && (
                  <div className="mt-2">
                    <h4 className="font-medium">Currículo</h4>
                    <ul className="space-y-1 text-sm">
                      {curriculoArquivos.map((arq, idx) => {
                        const nomeUsuario = limparNome(userData.nome_completo);
                        const link = `${import.meta.env.VITE_API_URL}/ver-curriculo/${nomeUsuario}/${arq}`;
                        return (
                          <li key={idx}>
                            <a href={link} onClick={(e) => handleFileClick(e, link, arq)} className="text-blue-500 hover:underline cursor-pointer">{arq}</a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Lista de arquivos de graduação por diploma */}
                {Object.keys(graduacaoArquivos).length > 0 && (
                  <div className="mt-2">
                    <h4 className="font-medium">Arquivos de Graduação</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {Object.entries(graduacaoArquivos).map(([diploma, arquivos]) => (
                        <div key={diploma}>
                          <div className="font-medium">{diploma.replace(/_/g, ' ')}</div>
                          <ul className="list-disc ml-6">
                            {arquivos.map((arq) => {
                              const nomeUsuario = limparNome(userData.nome_completo);
                              const diplomaClean = diploma; // já vem limpo do backend
                              const link = `${import.meta.env.VITE_API_URL}/ver-graduacao/${nomeUsuario}/${diplomaClean}/${arq}`;
                              return (
                                <li key={arq}><a href={link} onClick={(e) => handleFileClick(e, link, arq)} className="text-blue-500 hover:underline cursor-pointer">{arq}</a></li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <DataItem label="Conclusão" value={formatDate(userData.conclusao_superior)} />
                <Separator />
                <DataItem label="Pós-Graduação" value={(userData.pos_graduacao || []).join(', ') || 'N/A'} />
                <DataItem label="Conclusão" value={formatDate(userData.conclusao_pos)} />
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold">Cursos Adicionais</h3>
                <div className="flex flex-wrap gap-2">{userData.cursos.map(c => <Badge key={c} variant="outline">{c}</Badge>)}</div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};