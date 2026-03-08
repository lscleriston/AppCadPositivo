// src/pages/EditUserData.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/Layout/Header";
import { Save, X, Plus, Trash2, User, Briefcase, Award, BookOpen, Loader2, Upload, Paperclip } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useToast } from "@/components/ui/use-toast";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";

// Constante: Tamanho máximo de upload: 100 MB
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB em bytes
const MAX_UPLOAD_SIZE_MB = Math.round(MAX_UPLOAD_SIZE / (1024 * 1024)); // 100 MB

// Helper function para validar tamanho do arquivo
const validateFileSize = (file: File | null, maxSizeMB: number = MAX_UPLOAD_SIZE_MB): string | null => {
  if (!file) return null;
  if (file.size > MAX_UPLOAD_SIZE) {
    return `Arquivo muito grande. Tamanho máximo permitido: ${maxSizeMB} MB`;
  }
  return null;
};

// Interfaces
interface CertificacaoData {
  fornecedor: string;
  certificacao: string;
  emissao: string;
  validade: string;
  file?: File | null;
  fileName?: string;
  uploading?: boolean;
}

interface UserData {
  matricula: string;
  nome_completo: string;
  torre_atendimento: string;
  conhecimento: { value: string }[];
  operacao_principal: string;
  operacao_compartilhada: string[];
  certificacoes: CertificacaoData[];
  diploma_superior: { value: string; file?: File | null; fileName?: string }[];
  conclusao_superior?: string;
  pos_graduacao: { value: string }[];
  conclusao_pos?: string;
  cursos: { value: string }[];
  url_linkedin?: string;
  ultima_atualizacao: string;
}

interface TorreAtendimento { nome_torre: string; }
interface Operacao { operacao: string; }
interface CertificacaoOption { fornecedor: string; certificacao: string; }

// Mapeamento de nomes técnicos para nomes amigáveis
const mapearNomeCampo = (fieldName: string): string => {
  const mapa: { [key: string]: string } = {
    'nome_completo': 'Nome Completo',
    'operacao_principal': 'Operação Principal',
    'torre_atendimento': 'Torre de Atendimento',
    'certificacoes': 'Certificações (com anexo obrigatório)',
    'certificacao': 'Certificação',
    'emissao': 'Data de Emissão',
    'validade': 'Data de Validade',
  };
    // Expanding the friendly field mapping
    mapa['diploma_superior'] = 'Graduação (com arquivo obrigatório)';
    mapa['curriculo_atualizado'] = 'Currículo (arquivo obrigatório)';
    // Expanding the friendly field mapping
    mapa['diploma_superior'] = 'Graduação (com arquivo obrigatório)';
    mapa['curriculo_atualizado'] = 'Currículo (arquivo obrigatório)';
  return mapa[fieldName] || fieldName;
};

// Mapeia nomes de campo aninhados (ex: certificacoes.0.emissao) para nomes amigáveis
const friendlyNameFromPath = (path: string) => {
  if (!path) return path;
  // extrai o último segmento depois do ponto
  const parts = path.split('.');
  // exemplo: ['certificacoes','0','emissao'] -> last = 'emissao'
  const last = parts[parts.length - 1];
  // se o caminho começa com certificacoes, tratar casos específicos
  if (parts[0] === 'certificacoes') {
    if (last === 'emissao') return 'Data de Emissão (certificação)';
    if (last === 'validade') return 'Data de Validade (certificação)';
    if (last === 'fornecedor') return 'Fornecedor (certificação)';
    if (last === 'certificacao') return 'Nome da Certificação';
    if (last === 'fileName' || last === 'file') return 'Arquivo da Certificação';
  }
  if (parts[0] === 'diploma_superior') {
    if (last === 'value') return 'Graduação';
    if (last === 'fileName' || last === 'file') return 'Arquivo da Graduação';
  }
  return mapearNomeCampo(last || path);
};

// Helper component for a single certification item
const CertificacaoFormItem = ({ index, control, certificacoesOptions, removeCertificacao, getValues, setValue }: any) => {
  const certificacaoFileRefs = useRef<Array<HTMLInputElement | null>>([]);
  const fornecedor = useWatch({ control, name: `certificacoes.${index}.fornecedor` });
  const selectedFile = useWatch({ control, name: `certificacoes.${index}.file` });
  const fileName = useWatch({ control, name: `certificacoes.${index}.fileName` });
  const uploading = useWatch({ control, name: `certificacoes.${index}.uploading` });

  return (
    <div className="p-4 border rounded-lg space-y-4 relative">
      <Button type="button" onClick={() => removeCertificacao(index)} variant="ghost" size="sm" className="absolute top-1 right-1"><X className="h-4 w-4" /></Button>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`certificacoes.${index}.fornecedor`}
          rules={{ required: 'Fornecedor é obrigatório' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fornecedor</FormLabel>
              <Select onValueChange={(value) => {
                field.onChange(value);
                setValue(`certificacoes.${index}.certificacao`, ""); // Reset certification on provider change
              }} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  {[...new Set(certificacoesOptions.map((c: CertificacaoOption) => c.fornecedor))].map(f => <SelectItem key={String(f)} value={String(f)}>{String(f)}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`certificacoes.${index}.certificacao`}
          rules={{ required: 'Certificação é obrigatória' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Certificação</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!fornecedor}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  {certificacoesOptions.filter((c: CertificacaoOption) => c.fornecedor === fornecedor).map(c => <SelectItem key={c.certificacao} value={c.certificacao}>{c.certificacao}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`certificacoes.${index}.emissao`}
          rules={{
            validate: (value) => {
              // se houver uma certificação selecionada, a emissão é obrigatória
              const certSelected = getValues(`certificacoes.${index}.certificacao`);
              if (certSelected && (!value || value === '')) return 'Emissão é obrigatória';
              return true;
            }
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emissão</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField control={control} name={`certificacoes.${index}.validade`} render={({ field }) => (<FormItem><FormLabel>Validade</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>

      <div>
        <Label>Arquivo (Máx: {MAX_UPLOAD_SIZE_MB} MB)</Label>
        <div className="space-y-2 mt-1">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => certificacaoFileRefs.current[index]?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Escolher
            </Button>
            <input
              type="file"
              ref={el => { if(el) certificacaoFileRefs.current[index] = el; }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Validar tamanho do arquivo
                  const sizeError = validateFileSize(file);
                  if (sizeError) {
                    // Mostrar erro
                    console.error('[CertificacaoFormItem] File size validation error:', sizeError);
                    alert(sizeError);
                    // Não adicionar arquivo
                    e.target.value = '';
                    return;
                  }
                  setValue(`certificacoes.${index}.file`, file);
                  setValue(`certificacoes.${index}.fileName`, file.name);
                }
              }}
              className="hidden"
            />
            {/* Register fileName in form state and validate it (required only if certification selected) */}
            <FormField
              control={control}
              name={`certificacoes.${index}.fileName`}
              rules={{
                validate: (v) => {
                  const certSelected = getValues(`certificacoes.${index}.certificacao`);
                  if (certSelected && (!v || v === '')) return 'Arquivo da certificação é obrigatório';
                  return true;
                }
              }}
              render={({ field }) => (
                <FormItem>
                  <input type="hidden" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="text-sm text-muted-foreground truncate">{fileName || 'Nenhum arquivo selecionado'}</div>
        </div>
      </div>
    </div>
  );
};

export const EditUserData = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const curriculoFileRef = useRef<HTMLInputElement>(null);
  const diplomaFileRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [torres, setTorres] = useState<TorreAtendimento[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [certificacoesOptions, setCertificacoesOptions] = useState<CertificacaoOption[]>([]);
  const [curriculoFile, setCurriculoFile] = useState<File | null>(null);
  const [curriculoUploading, setCurriculoUploading] = useState(false);
  const [existingCurriculo, setExistingCurriculo] = useState<string>("");
  const [existingGraduacao, setExistingGraduacao] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);

  const form = useForm<UserData>({ defaultValues: { conhecimento: [], operacao_compartilhada: [], certificacoes: [], diploma_superior: [], pos_graduacao: [], cursos: [] } });
  const { control, handleSubmit, reset, setValue, getValues, trigger, formState } = form;

  const { fields: conhecimentoFields, append: appendConhecimento, remove: removeConhecimento } = useFieldArray({ control, name: "conhecimento" });
  const { fields: certificacoesFields, append: appendCertificacao, remove: removeCertificacao } = useFieldArray({ control, name: "certificacoes" });
  const { fields: diplomaFields, append: appendDiploma, remove: removeDiploma } = useFieldArray({ control, name: "diploma_superior" });
  const { fields: posGradFields, append: appendPosGrad, remove: removePosGrad } = useFieldArray({ control, name: "pos_graduacao" });
  const { fields: cursosFields, append: appendCurso, remove: removeCurso } = useFieldArray({ control, name: "cursos" });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        // Primeiro, carregar sempre as listas de opções (independente dos dados do usuário)
        const [torresResponse, operacoesResponse, certResponse] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/dados/torres-atendimento`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/dados/operacoes`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/dados/certificacoes`, { headers })
        ]);

        const certOptions = certResponse.data;
        setTorres(torresResponse.data);
        setOperacoes(operacoesResponse.data);
        setCertificacoesOptions(certOptions);

        // Agora tentar carregar os dados do usuário (pode falhar para usuário novo)
        try {
          const [userDataResponse, curriculoResponse] = await Promise.all([
            axios.get(`${import.meta.env.VITE_API_URL}/dados/me`, { headers }),
            axios.get(`${import.meta.env.VITE_API_URL}/dados/nome-arquivo-curriculo`, { headers })
          ]);

          const userData = userDataResponse.data;
          if (curriculoResponse.data.arquivos?.length) setExistingCurriculo(curriculoResponse.data.arquivos[0]);

          const certificacoesComNomes = await Promise.all(
            (userData.certificacoes || []).map(async (certName: string, index: number) => {
              const certOption = certOptions.find((opt: CertificacaoOption) => opt.certificacao === certName);
              let fileName = '';
              if (certOption) {
                try {
                  const fileResponse = await axios.get(`${import.meta.env.VITE_API_URL}/dados/nome-arquivo-certificacao`, { 
                    headers, 
                    params: { fornecedor: certOption.fornecedor, certificacao: certName }
                  });
                  if (fileResponse.data.arquivos?.length) fileName = fileResponse.data.arquivos[0];
                } catch (e) { console.log(`Nenhum arquivo para ${certName}`) }
              }
              return {
                fornecedor: certOption?.fornecedor || '',
                certificacao: certName,
                emissao: userData.emissao_certificacoes[index] ? new Date(userData.emissao_certificacoes[index]).toISOString().split('T')[0] : '',
                validade: userData.validade_certificacoes[index] ? new Date(userData.validade_certificacoes[index]).toISOString().split('T')[0] : '',
                fileName
              };
            })
          );

          // Para cada graduação tentar buscar arquivos associados
          const graduacoesComArquivos: Record<string, string[]> = {};
          for (const d of (userData.diploma_superior || [])) {
            try {
              const r = await axios.get(`${import.meta.env.VITE_API_URL}/dados/nome-arquivo-graduacao`, { headers, params: { diploma: d } });
              graduacoesComArquivos[d] = r.data.arquivos || [];
            } catch (e) {
              graduacoesComArquivos[d] = [];
            }
          }

          // Mapeia diplomas para incluir fileName quando existir
          const diplomasComNomes = (userData.diploma_superior || []).map((d: string) => ({ value: d, fileName: (graduacoesComArquivos[d] && graduacoesComArquivos[d].length) ? graduacoesComArquivos[d][0] : '' }));

          reset({
            ...userData,
            conhecimento: (userData.conhecimento || []).map((c: string) => ({ value: c })),
            certificacoes: certificacoesComNomes,
            diploma_superior: diplomasComNomes,
            pos_graduacao: (userData.pos_graduacao || []).map((p: string) => ({ value: p })),
            cursos: (userData.cursos || []).map((c: string) => ({ value: c })),
            conclusao_superior: userData.conclusao_superior ? new Date(userData.conclusao_superior).toISOString().split('T')[0] : '',
            conclusao_pos: userData.conclusao_pos ? new Date(userData.conclusao_pos).toISOString().split('T')[0] : '',
          });
          setExistingGraduacao(graduacoesComArquivos);
        } catch (userErr) {
          console.log("Usuário sem dados cadastrados ainda - carregando formulário vazio");
          if (axios.isAxiosError(userErr) && userErr.response?.status === 404) {
            setError("Primeiro acesso - preencha suas informações abaixo.");
            setIsNewUser(true);
            // Reset com valores padrão vazios
            reset({
              matricula: '',
              nome_completo: '',
              torre_atendimento: '',
              conhecimento: [],
              operacao_principal: '',
              operacao_compartilhada: [],
              certificacoes: [],
              diploma_superior: [],
              conclusao_superior: '',
              pos_graduacao: [],
              conclusao_pos: '',
              cursos: [],
              url_linkedin: '',
              ultima_atualizacao: ''
            });
          } else {
            setError("Erro ao carregar dados do usuário");
          }
        }
      } catch (err) {
        console.error("Erro ao carregar listas básicas:", err);
        setError("Erro ao carregar dados da aplicação. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reset]);








  const onSubmit = async (data: UserData) => {
    console.log('[EditUserData] onSubmit called', { existingCurriculo, curriculoFile });
    
    // Validar todos os campos RHF (será acionada validação automática de rules)
    const isValid = await trigger();
    if (!isValid) {
      console.log('[EditUserData] RHF validation failed', formState.errors);
      // Compilar lista de campos com erro para exibir mensagem amigável
      const errorFields = Object.keys(formState.errors);
      const camposComErro = errorFields.slice(0, 5).map(field => friendlyNameFromPath(field));
      const mensagem = `Campos obrigatórios não preenchidos:\n${camposComErro.join("\n")}${errorFields.length > 5 ? `\n... e mais ${errorFields.length - 5}` : ""}`;
      toast({ variant: "destructive", title: "Campos Faltando", description: mensagem });
      return;
    }
    
    // Validações customizadas adicionais (currículo, certificações com arquivo, etc.)
    const camposComErro: string[] = [];
    
    // Validar Currículo (obrigatório se não existe arquivo anterior ou arquivo novo)
    if (!existingCurriculo && !curriculoFile) {
      camposComErro.push("Currículo (arquivo obrigatório)");
    }
    
    // Validar Graduações têm arquivo
    for (let i = 0; i < (data.diploma_superior || []).length; i++) {
      const grad = data.diploma_superior[i];
      if (!grad.file && !grad.fileName) {
        camposComErro.push(`Arquivo de Graduação ${i + 1}`);
      }
    }
    
    // Validar Certificações têm arquivo
    for (let i = 0; i < (data.certificacoes || []).length; i++) {
      const cert = data.certificacoes[i];
      if (!cert.file && !cert.fileName) {
        camposComErro.push(`Certificação ${i + 1} - Arquivo`);
      }
    }
    
    if (camposComErro.length > 0) {
      console.log('[EditUserData] custom validation failed', camposComErro);
      const mensagem = `Arquivos obrigatórios não preenchidos:\n${camposComErro.slice(0, 5).join("\n")}${camposComErro.length > 5 ? `\n... e mais ${camposComErro.length - 5}` : ""}`;
      toast({ variant: "destructive", title: "Arquivos Faltando", description: mensagem });
      return;
    }

    try {

      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      // Transforma o payload para a API, removendo campos desnecessários
      const transformedData = {
        nome_completo: data.nome_completo,
        torre_atendimento: data.torre_atendimento,
        conhecimento: data.conhecimento.map(c => c.value),
        operacao_principal: data.operacao_principal,
        operacao_compartilhada: data.operacao_compartilhada,
        certificacoes: data.certificacoes.map(c => c.certificacao),
        emissao_certificacoes: data.certificacoes.map(c => c.emissao),
        validade_certificacoes: data.certificacoes.map(c => c.validade),
        diploma_superior: data.diploma_superior.map(d => d.value),
        conclusao_superior: data.conclusao_superior || null,
        pos_graduacao: data.pos_graduacao.map(p => p.value),
        conclusao_pos: data.conclusao_pos || null,
        cursos: data.cursos.map(c => c.value),
        url_linkedin: data.url_linkedin,
      };
      // Cria ou atualiza os dados principais do usuário
      if (isNewUser) {
        await axios.post(`${import.meta.env.VITE_API_URL}/dados`, transformedData, { headers: { 'Authorization': `Bearer ${token}` } });
      } else {
        await axios.put(`${import.meta.env.VITE_API_URL}/dados`, transformedData, { headers: { 'Authorization': `Bearer ${token}` } });
      }
      // Agora realiza upload de arquivos
      // Faz upload de todas as certificações selecionadas
      for (let i = 0; i < data.certificacoes.length; i++) {
        const cert = data.certificacoes[i];
        if (cert.file) {
          const formData = new FormData();
          formData.append('file', cert.file);
          formData.append('tipo', 'certificacoes');
          formData.append('fornecedor', cert.fornecedor);
          formData.append('certificacao', cert.certificacao);
          formData.append('emissao', cert.emissao);
          formData.append('validade', cert.validade);
          await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
          });
        }
      }
      // Faz upload do currículo, se houver
      if (curriculoFile) {
        const formData = new FormData();
        formData.append('file', curriculoFile);
        formData.append('tipo', 'curriculo');
        await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
        });
        setExistingCurriculo(curriculoFile.name);
      }
      // Faz upload dos arquivos de graduação, se houver
      for (let i = 0; i < data.diploma_superior.length; i++) {
        const grad = data.diploma_superior[i];
        if ((grad as any).file) {
          const formData = new FormData();
          formData.append('file', (grad as any).file);
          formData.append('tipo', 'graduacao');
          // enviamos o nome do diploma no campo 'fornecedor' para o backend usar como pasta
          formData.append('fornecedor', grad.value);
          await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
          });
        }
      }
      toast({ title: "Sucesso!", description: "Dados atualizados com sucesso." });
      setSubmitting(false);
      navigate("/dados");
    } catch (err) {
      setSubmitting(false);
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        console.log('[EditUserData] backend 422 payload:', err.response?.data);
        const errors = err.response.data.detail || [];
        const camposComErro: string[] = [];
        
        errors.forEach((error: { loc: (string | number)[]; msg: string }) => {
          const fieldName = error.loc[1]?.toString();
          if (fieldName) {
            // Mapear nomes técnicos para nomes amigáveis
            const friendlyName = friendlyNameFromPath(fieldName);
            camposComErro.push(friendlyName);
            // Destacar o campo com erro no formulário
            setFormError(fieldName as any, { type: "required", message: "Campo obrigatório" });
          }
        });
        
        const mensagem = camposComErro.length > 0 
          ? `Por favor, preencha os campos obrigatórios: ${camposComErro.join(", ")}`
          : "Por favor, corrija os campos destacados.";
        
        toast({ variant: "destructive", title: "Campos Obrigatórios", description: mensagem });
      } else {
        console.error("Erro ao atualizar dados:", err);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar os dados." });
      }
    }
  };

  const { currentUser } = useCurrentUser();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8">
        {error && ( // Conditionally render the error message
          <div className="text-center mb-4">
            <p className="text-destructive text-lg">{error}</p>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="text-center space-y-2"><h1 className="text-3xl font-bold">Editar Meus Dados</h1><p className="text-muted-foreground">Atualize suas informações.</p></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-elegant">
                  <CardHeader><CardTitle>Informações Gerais</CardTitle></CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <FormField control={control} name="nome_completo" rules={{ required: 'Nome Completo é obrigatório' }} render={({ field }) => (<FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="url_linkedin" render={({ field }) => (<FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://www.linkedin.com/in/seu-perfil" /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={control} name="torre_atendimento" rules={{ required: 'Torre de Atendimento é obrigatória' }} render={({ field }) => (<FormItem><FormLabel>Torre de Atendimento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{torres.map(t => <SelectItem key={t.nome_torre} value={t.nome_torre}>{t.nome_torre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={control} name="operacao_principal" rules={{ required: 'Operação Principal é obrigatória' }} render={({ field }) => (<FormItem><FormLabel>Operação Principal</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{operacoes.map(o => <SelectItem key={o.operacao} value={o.operacao}>{o.operacao}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={control} name="operacao_compartilhada" render={() => (<FormItem><FormLabel>Operações Compartilhadas</FormLabel><div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 rounded-md border">{operacoes.map(op => (<FormField key={op.operacao} control={control} name="operacao_compartilhada" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><input type="checkbox" className="form-checkbox" checked={field.value?.includes(op.operacao)} onChange={e => field.onChange(e.target.checked ? [...(field.value || []), op.operacao] : field.value.filter(v => v !== op.operacao))} /></FormControl><FormLabel className="font-normal">{op.operacao}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
                    <Separator />
                    <DynamicFieldSection control={control} title="Conhecimentos" fields={conhecimentoFields} name="conhecimento" remove={removeConhecimento} append={() => appendConhecimento({ value: '' })} />
                    <Separator />
                    <FormacaoAcademicaSection control={control} diplomaFields={diplomaFields} removeDiploma={removeDiploma} appendDiploma={() => appendDiploma({ value: '' })} posGradFields={posGradFields} removePosGrad={removePosGrad} appendPosGrad={() => appendPosGrad({ value: '' })} setValue={setValue} diplomaFileRefs={diplomaFileRefs} />
                    <Separator />
                    <DynamicFieldSection control={control} title="Cursos" fields={cursosFields} name="cursos" remove={removeCurso} append={() => appendCurso({ value: '' })} />
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card className="shadow-elegant">
                  <CardHeader className="bg-gradient-secondary/10 border-b">
                    <CardTitle className="text-secondary flex items-center justify-between">
                      Certificações
                      <Button type="button" onClick={() => appendCertificacao({ fornecedor: '', certificacao: '', emissao: '', validade: '', file: null, fileName: '' })} size="sm" className="bg-secondary hover:bg-secondary/90 text-white">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {certificacoesFields.map((field, index) => <CertificacaoFormItem key={field.id} index={index} control={control} certificacoesOptions={certificacoesOptions} removeCertificacao={removeCertificacao} getValues={getValues} setValue={setValue} />)}
                  </CardContent>
                </Card>
                <Card className="shadow-elegant">
                  <CardHeader><CardTitle>Currículo</CardTitle></CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {existingCurriculo && <div className="text-sm text-muted-foreground">Arquivo atual: <span className="font-medium text-foreground">{existingCurriculo}</span></div>}
                    <div>
                      <Label>Novo Arquivo (Máx: {MAX_UPLOAD_SIZE_MB} MB)</Label>
                      <div className="space-y-2 mt-1">
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" onClick={() => curriculoFileRef.current?.click()}><Paperclip className="h-4 w-4 mr-2" />Selecionar Currículo</Button>
                          {/* Upload será realizado ao salvar formulário */}
                          <input type="file" ref={curriculoFileRef} onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validar tamanho do arquivo
                              const sizeError = validateFileSize(file);
                              if (sizeError) {
                                console.error('[EditUserData] Currículo file size validation error:', sizeError);
                                alert(sizeError);
                                // Não adicionar arquivo
                                e.target.value = '';
                                return;
                              }
                              setCurriculoFile(file);
                            }
                          }} className="hidden" />
                        </div>
                        <div className="text-sm text-muted-foreground">{curriculoFile?.name || 'Nenhum arquivo selecionado'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <div className="flex justify-center gap-4"><Button type="button" onClick={() => navigate("/dados")} size="lg" variant="outline">Cancelar</Button><Button type="submit" disabled={submitting} size="lg">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Salvar Alterações</Button></div>
          </form>
        </Form>
      </main>
    </div>
  );
};

const DynamicFieldSection = ({ control, title, fields, name, remove, append }: any) => (
  <div>
    <h3 className="font-semibold text-lg mb-4">{title}</h3>
    {fields.map((field: any, index: number) => (
      <FormField key={field.id} control={control} name={`${name}.${index}.value`} render={({ field: renderField }) => (<FormItem><div className="flex gap-2 mb-2"><FormControl><Input {...renderField} placeholder={`Digite um ${name.slice(0, -1)}`} /></FormControl><Button type="button" onClick={() => remove(index)} variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></div><FormMessage /></FormItem>)} />
    ))}
    <Button type="button" onClick={append} variant="outline" className="mt-2">Adicionar {title}</Button>
  </div>
);

const FormacaoAcademicaSection = ({ control, diplomaFields, removeDiploma, appendDiploma, posGradFields, removePosGrad, appendPosGrad, setValue, diplomaFileRefs }: any) => (
  <div>
    <h3 className="font-semibold text-lg mb-4">Formação Acadêmica</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-medium mb-3">Graduação</h4>
        {diplomaFields.map((field: any, index: number) => (
          <div key={field.id} className="mb-3">
            <FormField control={control} name={`diploma_superior.${index}.value`} render={({ field: renderField }) => (
              <FormItem>
                <div className="flex gap-2 mb-2 items-center">
                  <FormControl><Input {...renderField} placeholder="Curso de graduação" /></FormControl>
                  <Button type="button" onClick={() => removeDiploma(index)} variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={control} name={`diploma_superior.${index}.fileName`} render={({ field: fNameField }) => (
              <FormItem>
                <FormLabel>Arquivo de Graduação (Máx: {MAX_UPLOAD_SIZE_MB} MB)</FormLabel>
                <div className="space-y-2 mt-1">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => diplomaFileRefs.current[index]?.click()}><Paperclip className="h-4 w-4 mr-2" />Selecionar</Button>
                    <input
                      type="file"
                      ref={el => { if (el) diplomaFileRefs.current[index] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Validar tamanho do arquivo
                          const sizeError = validateFileSize(file);
                          if (sizeError) {
                            console.error('[FormacaoAcademicaSection] Diploma file size validation error:', sizeError);
                            alert(sizeError);
                            // Não adicionar arquivo
                            e.target.value = '';
                            return;
                          }
                          setValue(`diploma_superior.${index}.file`, file);
                          setValue(`diploma_superior.${index}.fileName`, file.name);
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">{fNameField.value || 'Nenhum arquivo selecionado'}</div>
                </div>
              </FormItem>
            )} />
          </div>
        ))}
        {diplomaFields.length < 1 && <Button type="button" onClick={appendDiploma} variant="outline" className="mt-2">Adicionar Graduação</Button>}
        {diplomaFields.length > 0 && <FormField control={control} name="conclusao_superior" render={({ field }) => (<FormItem className="mt-4"><FormLabel>Conclusão</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />}
      </div>
      <div>
        <h4 className="font-medium mb-3">Pós-Graduação</h4>
        {posGradFields.map((field: any, index: number) => (
          <FormField key={field.id} control={control} name={`pos_graduacao.${index}.value`} render={({ field: renderField }) => (<FormItem><div className="flex gap-2 mb-2"><FormControl><Input {...renderField} placeholder="Curso de pós-graduação" /></FormControl><Button type="button" onClick={() => removePosGrad(index)} variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></div><FormMessage /></FormItem>)} />
        ))}
        {posGradFields.length < 1 && <Button type="button" onClick={appendPosGrad} variant="outline" className="mt-2">Adicionar Pós-Graduação</Button>}
        {posGradFields.length > 0 && <FormField control={control} name="conclusao_pos" render={({ field }) => (<FormItem className="mt-4"><FormLabel>Conclusão</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />}
      </div>
    </div>
  </div>
);