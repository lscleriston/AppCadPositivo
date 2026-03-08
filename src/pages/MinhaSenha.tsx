import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import { Header } from "@/components/Layout/Header";
import { Loader2, KeyRound } from "lucide-react";

export const MinhaSenha = () => {
    const { toast } = useToast();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

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
        if (password.length < 6) {
            toast({
                variant: "destructive",
                title: "Senha muito curta",
                description: "A senha deve ter pelo menos 6 caracteres.",
            });
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            await axios.put(`${import.meta.env.VITE_API_URL}/atualizar-senha`, 
                { nova_senha: password },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast({
                title: "Sucesso!",
                description: "Sua senha foi alterada.",
            });
            setPassword("");
            setConfirmPassword("");
        } catch (error) {
            console.error("Erro ao redefinir senha:", error);
            toast({
                variant: "destructive",
                title: "Erro ao redefinir senha",
                description: "Não foi possível alterar sua senha. Tente novamente.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-subtle">
            <Header />
            <main className="container mx-auto px-6 py-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="shadow-elegant">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><KeyRound className="h-6 w-6 text-primary"/>Alterar Minha Senha</CardTitle>
                            <CardDescription>
                                Para sua segurança, escolha uma senha forte que você não use em outro lugar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Salvar Nova Senha
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};
