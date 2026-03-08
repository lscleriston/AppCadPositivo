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
import { useForm, useFieldArray } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Interfaces
interface CertificacaoData {
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
  diploma_superior: { value: string }[];
  conclusao_superior?: string;
  pos_graduacao: { value: string }[];
  conclusao_pos?: string;
  cursos: { value: string }[];
  ultima_atualizacao: string;
}

interface TorreAtendimento { nome_torre: string; }
interface Operacao { operacao: string; }
interface CertificacaoOption { fornecedor: string; certificacao: string; }

export const EditUserData = () => {
  // Hooks
  const navigate = useNavigate();
  const { toast } = useToast();
  const certificacaoFileRefs = useRef<Array<HTMLInputElement | null>>([]);
  const curriculoFileRef = useRef<HTMLInputElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [torres, setTorres] = useState<TorreAtendimento[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [certificacoesOptions, setCertificacoesOptions] = useState<CertificacaoOption[]>([]);
  const [curriculoFile, setCurriculoFile] = useState<File | null>(null);
  const [curriculoUploading, setCurriculoUploading] = useState(false);
  const [existingCurriculo, setExistingCurriculo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Form
  const form = useForm<UserData>({
    defaultValues: {
      conhecimento: [],
      operacao_compartilhada: [],
      certificacoes: [],
      diploma_superior: [],
      pos_graduacao: [],
      cursos: [],
    },
  });
  const { control, handleSubmit, reset, setValue, getValues, setError: setFormError } = form;

  // Field Arrays
  const { fields: conhecimentoFields, append: appendConhecimento, remove: removeConhecimento } = useFieldArray({ control, name: "conhecimento" });
  const { fields: certificacoesFields, append: appendCertificacao, remove: removeCertificacao } = useFieldArray({ control, name: "certificacoes" });
  const { fields: diplomaFields, append: appendDiploma, remove: removeDiploma } = useFieldArray({ control, name: "diploma_superior" });
  const { fields: posGradFields, append: appendPosGrad, remove: removePosGrad } = useFieldArray({ control, name: "pos_graduacao" });
  const { fields: cursosFields, append: appendCurso, remove: removeCurso } = useFieldArray({ control, name: "cursos" });

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const [userDataResponse, torresResponse, operacoesResponse, certResponse, curriculoResponse] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/dados/me`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/dados/torres-atendimento`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/dados/operacoes`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/dados/certificacoes`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/dados/nome-arquivo-curriculo`, { headers })
        ]);

        const userData = userDataResponse.data;
        const certOptions = certResponse.data;
        setTorres(torresResponse.data);
        setOperacoes(operacoesResponse.data);
        setCertificacoesOptions(certOptions);
        if (curriculoResponse.data.arquivos && curriculoResponse.data.arquivos.length > 0) {
          setExistingCurriculo(curriculoResponse.data.arquivos[0]);
        }

        // Fetch existing certification filenames
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
                if (fileResponse.data.arquivos && fileResponse.data.arquivos.length > 0) {
                  fileName = fileResponse.data.arquivos[0];
                }
              } catch (e) {
                console.log(`Nenhum arquivo encontrado para ${certName}`)
              }
            }
            return {
              certificacao: certName,
              emissao: userData.emissao_certificacoes[index] ? new Date(userData.emissao_certificacoes[index]).toISOString().split('T')[0] : '',
              validade: userData.validade_certificacoes[index] ? new Date(userData.validade_certificacoes[index]).toISOString().split('T')[0] : '',
              file: null,
              fileName: fileName
            };
          })
        );

        reset({
          ...userData,
          conhecimento: (userData.conhecimento || []).map((c: string) => ({ value: c })),
          certificacoes: certificacoesComNomes,
          diploma_superior: (userData.diploma_superior || []).map((d: string) => ({ value: d })),
          pos_graduacao: (userData.pos_graduacao || []).map((p: string) => ({ value: p })),
          cursos: (userData.cursos || []).map((c: string) => ({ value: c })),
          conclusao_superior: userData.conclusao_superior ? new Date(userData.conclusao_superior).toISOString().split('T')[0] : '',
          conclusao_pos: userData.conclusao_pos ? new Date(userData.conclusao_pos).toISOString().split('T')[0] : '',
        });

      } catch (err) {
        console.error("Erro ao buscar dados:", err);
        setError("Erro ao carregar dados para edição");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reset]);

  // File Handling
  const handleUpload = async (tipo: 'certificacoes' | 'curriculo', index?: number) => {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    let file: File | null | undefined = null;

    if (tipo === 'certificacoes' && index !== undefined) {
      const certData = getValues(`certificacoes.${index}`);
      file = certData.file;
      if (!file) { toast({ title: "Nenhum arquivo selecionado", variant: "destructive" }); return; }
      const certOption = certificacoesOptions.find(c => c.certificacao === certData.certificacao);
      if (!certOption) { toast({ title: "Selecione uma certificação válida", variant: "destructive" }); return; }
      formData.append('fornecedor', certOption.fornecedor);
      formData.append('certificacao', certData.certificacao);
      formData.append('emissao', certData.emissao);
      formData.append('validade', certData.validade);
      setValue(`certificacoes.${index}.uploading`, true);
    } else if (tipo === 'curriculo') {
      file = curriculoFile;
      if (!file) { toast({ title: "Nenhum arquivo selecionado", variant: "destructive" }); return; }
      setCurriculoUploading(true);
    }

    if (!file) return;

    formData.append('file', file);
    formData.append('tipo', tipo);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` } });
      toast({ title: "Upload realizado com sucesso!" });
      if (tipo === 'curriculo') setExistingCurriculo(file.name);
      if (tipo === 'certificacoes' && index !== undefined) setValue(`certificacoes.${index}.fileName`, file.name);
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({ title: "Erro ao fazer upload do arquivo", variant: "destructive" });
    } finally {
      if (tipo === 'certificacoes' && index !== undefined) setValue(`certificacoes.${index}.uploading`, false);
      else if (tipo === 'curriculo') setCurriculoUploading(false);
    }
  };

  // Form Submission
  const onSubmit = async (data: UserData) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth_token');
      const transformedData = {
        ...data,
        conhecimento: data.conhecimento.map(c => c.value),
        certificacoes: data.certificacoes.map(c => c.certificacao),
        emissao_certificacoes: data.certificacoes.map(c => c.emissao),
        validade_certificacoes: data.certificacoes.map(c => c.validade),
        diploma_superior: data.diploma_superior.map(d => d.value),
        pos_graduacao: data.pos_graduacao.map(p => p.value),
        cursos: data.cursos.map(c => c.value),
      };

      await axios.put(`${import.meta.env.VITE_API_URL}/dados`, transformedData, { headers: { 'Authorization': `Bearer ${token}` } });
      toast({ title: "Sucesso!", description: "Dados atualizados com sucesso." });
      navigate("/dados");
    } catch (err) {
      setSubmitting(false);
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const errors = err.response.data.detail || [];
        errors.forEach((error: { loc: (string | number)[]; msg: string }) => {
          const fieldName = error.loc[1]?.toString();
          const index = error.loc[2] as number;
          const message = error.msg.includes("Field required") ? "Campo obrigatório" : "Valor inválido";

          if (fieldName === 'emissao_certificacoes' && index !== undefined) {
            setFormError(`certificacoes.${index}.emissao`, { type: 'manual', message });
          } else if (fieldName === 'validade_certificacoes' && index !== undefined) {
            setFormError(`certificacoes.${index}.validade`, { type: 'manual', message });
          } else {
             const otherFieldName = fieldName as keyof UserData;
             if (otherFieldName) {
                setFormError(otherFieldName, { type: 'manual', message });
             }
          }
        });
        toast({ variant: "destructive", title: "Erro de Validação", description: "Por favor, corrija os campos destacados." });
      } else {
        console.error("Erro ao atualizar dados:", err);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar os dados." });
      }
    }
  };

  // Render Logic
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">{error}</p></div>;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold">Editar Meus Dados</h1>
              <p className="text-muted-foreground">Atualize suas informações pessoais, profissionais e de certificação.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-elegant">
                  <CardHeader><CardTitle>Informações Gerais</CardTitle></CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <FormField control={control} name="nome_completo" render={({ field }) => (<FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={control} name="torre_atendimento" render={({ field }) => (<FormItem><FormLabel>Torre de Atendimento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{torres.map(t => <SelectItem key={t.nome_torre} value={t.nome_torre}>{t.nome_torre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={control} name="operacao_principal" render={({ field }) => (<FormItem><FormLabel>Operação Principal</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{operacoes.map(o => <SelectItem key={o.operacao} value={o.operacao}>{o.operacao}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={control} name="operacao_compartilhada" render={() => (<FormItem><FormLabel>Operações Compartilhadas</FormLabel><div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 rounded-md border">{operacoes.map(op => (<FormField key={op.operacao} control={control} name="operacao_compartilhada" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><input type="checkbox" className="form-checkbox" checked={field.value?.includes(op.operacao)} onChange={e => field.onChange(e.target.checked ? [...(field.value || []), op.operacao] : field.value.filter(v => v !== op.operacao))} /></FormControl><FormLabel className="font-normal">{op.operacao}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
                    <Separator />
                    <DynamicFieldSection control={control} title="Conhecimentos" fields={conhecimentoFields} name="conhecimento" remove={removeConhecimento} append={() => appendConhecimento({ value: '' })} />
                    <Separator />
                    <FormacaoAcademicaSection control={control} diplomaFields={diplomaFields} removeDiploma={removeDiploma} appendDiploma={() => appendDiploma({ value: '' })} posGradFields={posGradFields} removePosGrad={removePosGrad} appendPosGrad={() => appendPosGrad({ value: '' })} />
                    <Separator />
                    <DynamicFieldSection control={control} title="Cursos" fields={cursosFields} name="cursos" remove={removeCurso} append={() => appendCurso({ value: '' })} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="shadow-elegant">
                  <CardHeader><CardTitle>Certificações</CardTitle></CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {certificacoesFields.map((field, index) => (
                      <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                        <Button type="button" onClick={() => removeCertificacao(index)} variant="ghost" size="sm" className="absolute top-1 right-1"><X className="h-4 w-4" /></Button>
                        <FormField control={control} name={`certificacoes.${index}.certificacao`} render={({ field }) => (<FormItem><FormLabel>Certificação</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{certificacoesOptions.map(c => <SelectItem key={c.certificacao} value={c.certificacao}>{c.certificacao}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={control} name={`certificacoes.${index}.emissao`} render={({ field }) => (<FormItem><FormLabel>Emissão</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={control} name={`certificacoes.${index}.validade`} render={({ field }) => (<FormItem><FormLabel>Validade</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div>
                          <Label>Arquivo</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Button type="button" variant="outline" size="sm" onClick={() => certificacaoFileRefs.current[index]?.click()}> <Upload className="h-4 w-4 mr-2" /> Escolher</Button>
                            <input type="file" ref={el => { if(el) certificacaoFileRefs.current[index] = el; }} onChange={(e) => { const file = e.target.files?.[0]; if (file) setValue(`certificacoes.${index}.file`, file); setValue(`certificacoes.${index}.fileName`, file.name); }} className="hidden" />
                            <span className="text-sm text-muted-foreground truncate w-28">{getValues(`certificacoes.${index}.fileName`) || 'Nenhum arquivo'}</span>
                            {getValues(`certificacoes.${index}.file`) && (
                              <Button type="button" size="sm" onClick={() => handleUpload('certificacoes', index)} disabled={getValues(`certificacoes.${index}.uploading`)}>
                                {getValues(`certificacoes.${index}.uploading`) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button type="button" onClick={() => appendCertificacao({ certificacao: '', emissao: '', validade: '', file: null, fileName: '' })} variant="outline" className="w-full">Adicionar Certificação</Button>
                  </CardContent>
                </Card>
                <Card className="shadow-elegant">
                  <CardHeader><CardTitle>Currículo</CardTitle></CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {existingCurriculo && <div className="text-sm text-muted-foreground">Arquivo atual: <span className="font-medium text-foreground">{existingCurriculo}</span></div>}
                    <div>
                      <Label>Novo Arquivo</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button type="button" variant="outline" onClick={() => curriculoFileRef.current?.click()}><Paperclip className="h-4 w-4 mr-2" />Selecionar Currículo</Button>
                        <input type="file" ref={curriculoFileRef} onChange={(e) => setCurriculoFile(e.target.files?.[0] || null)} className="hidden" />
                        <span className="text-sm text-muted-foreground truncate">{curriculoFile?.name || 'Nenhum arquivo'}</span>
                      </div>
                    </div>
                    <Button type="button" className="w-full" onClick={() => handleUpload('curriculo')} disabled={!curriculoFile || curriculoUploading}>
                      {curriculoUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload do Currículo
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button type="button" onClick={() => navigate("/dados")} size="lg" variant="outline">Cancelar</Button>
              <Button type="submit" disabled={submitting} size="lg">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
            </div>
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

const FormacaoAcademicaSection = ({ control, diplomaFields, removeDiploma, appendDiploma, posGradFields, removePosGrad, appendPosGrad }: any) => (
  <div>
    <h3 className="font-semibold text-lg mb-4G">Formação Acadêmica</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-medium mb-3">Graduação</h4>
        {diplomaFields.map((field: any, index: number) => (
          <FormField key={field.id} control={control} name={`diploma_superior.${index}.value`} render={({ field: renderField }) => (<FormItem><div className="flex gap-2 mb-2"><FormControl><Input {...renderField} placeholder="Curso de graduação" /></FormControl><Button type="button" onClick={() => removeDiploma(index)} variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></div><FormMessage /></FormItem>)} />
        ))}
        <Button type="button" onClick={appendDiploma} variant="outline" className="mt-2">Adicionar Graduação</Button>
        <FormField control={control} name="conclusao_superior" render={({ field }) => (<FormItem className="mt-4"><FormLabel>Conclusão</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>
      <div>
        <h4 className="font-medium mb-3">Pós-Graduação</h4>
        {posGradFields.map((field: any, index: number) => (
          <FormField key={field.id} control={control} name={`pos_graduacao.${index}.value`} render={({ field: renderField }) => (<FormItem><div className="flex gap-2 mb-2"><FormControl><Input {...renderField} placeholder="Curso de pós-graduação" /></FormControl><Button type="button" onClick={() => removePosGrad(index)} variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></div><FormMessage /></FormItem>)} />
        ))}
        <Button type="button" onClick={appendPosGrad} variant="outline" className="mt-2">Adicionar Pós-Graduação</Button>
        <FormField control={control} name="conclusao_pos" render={({ field }) => (<FormItem className="mt-4"><FormLabel>Conclusão</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>
    </div>
  </div>
);
