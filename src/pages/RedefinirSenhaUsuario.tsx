import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import { Header } from "@/components/Layout/Header";
import { Loader2, UserCheck, UserX, KeyRound } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";


export const RedefinirSenhaUsuario = () => {
    const { toast } = useToast();
    const { isAdmin, loading: adminCheckLoading } = useIsAdmin();

    const [matricula, setMatricula] = useState("");
    const [user, setUser] = useState<{ matricula: string; nome_completo: string } | null>(null);
    const [userFound, setUserFound] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);

    const handleVerifyUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setUser(null);
        setUserFound(false);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/${matricula}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUser(response.data);
            setUserFound(true);
            toast({
                title: "Usuário Encontrado",
                description: `Pronto para redefinir a senha de ${response.data.nome_completo}.`,
            });
        } catch (error) {
            console.error("Erro ao verificar usuário:", error);
            toast({
                variant: "destructive",
                title: "Usuário não encontrado",
                description: "Verifique a matrícula e tente novamente.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "As senhas não coincidem.",
            });
            return;
        }
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            await axios.put(`${import.meta.env.VITE_API_URL}/${matricula}/redefinir-senhas`, 
                { nova_senha: password },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast({
                title: "Sucesso",
                description: "Senha redefinida com sucesso!",
            });
            // Reset state
            setMatricula("");
            setUser(null);
            setUserFound(false);
            setPassword("");
            setConfirmPassword("");
        } catch (error) {
            console.error("Erro ao redefinir senha:", error);
            toast({
                variant: "destructive",
                title: "Erro ao redefinir senha",
                description: "Não foi possível redefinir a senha. Tente novamente.",
            });
        } finally {
            setLoading(false);
        }
    };
    
    if (adminCheckLoading) {
        return (
            <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-lg">Verificando permissões...</p>
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
            <main className="container mx-auto px-6 py-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="shadow-elegant">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><KeyRound className="h-6 w-6 text-primary"/>Redefinir Senha de Usuário</CardTitle>
                            <CardDescription>
                                { !userFound 
                                    ? "Insira a matrícula do usuário para buscar e redefinir a senha."
                                    : `Redefinindo a senha para ${user?.nome_completo}.`
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!userFound ? (
                                <form onSubmit={handleVerifyUser} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="matricula">Matrícula</Label>
                                        <Input 
                                            id="matricula"
                                            placeholder="Digite a matrícula"
                                            value={matricula}
                                            onChange={(e) => setMatricula(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                        Verificar Usuário
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Nova Senha</Label>
                                        <Input 
                                            id="password"
                                            type="password"
                                            placeholder="Digite a nova senha"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                                        <Input 
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="Confirme a nova senha"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <Button type="button" variant="outline" className="w-full" onClick={() => { setUserFound(false); setUser(null); setMatricula("")}}>
                                            Cancelar
                                        </Button>
                                        <Button type="submit" className="w-full" disabled={loading}>
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Redefinir Senha
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};