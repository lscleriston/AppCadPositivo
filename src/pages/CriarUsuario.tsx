import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Layout/Header";
import { Loader2, UserPlus, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema de validação com Zod
const formSchema = z.object({
  matricula: z.string().min(1, "Matrícula é obrigatória"),
  nome: z.string().optional(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  confirmarSenha: z.string(),
  is_admin: z.boolean().default(false),
  is_super_admin: z.boolean().default(false),
}).refine((data) => data.password === data.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"], // Define o campo onde o erro será exibido
});

type FormData = z.infer<typeof formSchema>;

export const CriarUsuario = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserRoles, setCurrentUserRoles] = useState({ is_admin: false, is_super_admin: false });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      matricula: "",
      nome: "",
      password: "",
      confirmarSenha: "",
      is_admin: false,
      is_super_admin: false,
    },
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.is_super_admin || response.data.is_admin) {
          setIsAuthorized(true);
          setCurrentUserRoles({ is_admin: response.data.is_admin, is_super_admin: response.data.is_super_admin });
        } else {
          setError("Acesso não autorizado.");
        }
      } catch (err) {
        console.error("Erro na verificação de permissão:", err);
        setError("Ocorreu um erro ao verificar suas permissões. Tente fazer login novamente.");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`${import.meta.env.VITE_API_URL}/register`, {
        matricula: data.matricula,
        nome: data.nome || null, // Envia null se vazio
        password: data.password,
        is_admin: data.is_admin,
        is_super_admin: data.is_super_admin,
        id_dados: null, // id_dados é gerenciado pelo backend
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      toast({
        title: "Sucesso!",
        description: "Usuário criado com sucesso.",
      });
      form.reset(); // Limpa o formulário
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
      toast({
        variant: "destructive",
        title: "Erro ao criar usuário",
        description: axios.isAxiosError(err) && err.response?.data?.detail ? err.response.data.detail : "Ocorreu um erro inesperado.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <main className="container mx-auto px-6 py-8 text-center">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/dados')} className="mt-4">Voltar para Meus Dados</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold">Criar Novo Usuário</h1>
              <p className="text-muted-foreground">Preencha os dados para criar uma nova conta.</p>
            </div>
          </div>

          <Card className="shadow-elegant">
            <CardHeader><CardTitle>Dados do Usuário</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="matricula" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome (Opcional)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="confirmarSenha" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {(currentUserRoles.is_super_admin || currentUserRoles.is_admin) && (
                    <div className="flex flex-col space-y-2">
                      <FormField control={form.control} name="is_admin" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Usuário Admin</FormLabel>
                            <FormDescription>Concede permissões de administrador.</FormDescription>
                          </div>
                        </FormItem>
                      )} />
                      {currentUserRoles.is_super_admin && (
                        <FormField control={form.control} name="is_super_admin" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Usuário Super Admin</FormLabel>
                              <FormDescription>Concede permissões de super administrador.</FormDescription>
                            </div>
                          </FormItem>
                        )} />
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Criar Usuário
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
