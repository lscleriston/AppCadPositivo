import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import { Header } from "@/components/Layout/Header";
import { Loader2, UserX, PlusCircle, Trash2, Save } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Operacao {
    id?: number; // Opcional, pode não vir do GET inicial
    operacao: string;
}

export const EditarOperacoes = () => {
    const { toast } = useToast();
    const { isSuperAdmin, loading: adminCheckLoading } = useIsSuperAdmin();
    
    const [operacoes, setOperacoes] = useState<Operacao[]>([]);
    const [novaOperacao, setNovaOperacao] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isSuperAdmin) {
            fetchOperacoes();
        }
    }, [isSuperAdmin]);

    const fetchOperacoes = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/dados/operacoes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setOperacoes(response.data);
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao buscar operações", description: "Não foi possível carregar a lista de operações." });
        } finally {
            setLoading(false);
        }
    };

    const handleAddOperacao = () => {
        if (novaOperacao.trim() === "") {
            toast({ variant: "destructive", title: "Operação inválida", description: "O nome da operação não pode ser vazio." });
            return;
        }
        setOperacoes([...operacoes, { operacao: novaOperacao.trim() }]);
        setNovaOperacao("");
    };

    const handleUpdateOperacao = (index: number, value: string) => {
        const updatedOperacoes = [...operacoes];
        updatedOperacoes[index].operacao = value;
        setOperacoes(updatedOperacoes);
    };

    const handleRemoveOperacao = (index: number) => {
        const updatedOperacoes = [...operacoes];
        updatedOperacoes.splice(index, 1);
        setOperacoes(updatedOperacoes);
    };

    const handleSaveChanges = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            await axios.put(`${import.meta.env.VITE_API_URL}/atualizar-operacoes`, 
                operacoes,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast({ title: "Sucesso", description: "Lista de operações atualizada com sucesso!" });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar as alterações." });
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

    if (!isSuperAdmin) {
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
                <div className="max-w-4xl mx-auto">
                    <Card className="shadow-elegant">
                        <CardHeader>
                            <CardTitle>Editar Operações</CardTitle>
                            <CardDescription>Adicione, edite ou remova as operações disponíveis no sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading && !operacoes.length ? (
                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                            ) : (
                                <div className="space-y-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nome da Operação</TableHead>
                                                <TableHead className="w-[120px]">Ação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {operacoes.map((op, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <Input 
                                                            value={op.operacao}
                                                            onChange={(e) => handleUpdateOperacao(index, e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveOperacao(index)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell>
                                                    <Input 
                                                        placeholder="Nome da nova operação"
                                                        value={novaOperacao}
                                                        onChange={(e) => setNovaOperacao(e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button onClick={handleAddOperacao} className="w-full">
                                                        <PlusCircle className="h-4 w-4 mr-2"/> Adicionar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <div className="flex justify-end">
                                        <Button onClick={handleSaveChanges} disabled={loading}>
                                            <Save className="h-4 w-4 mr-2" />
                                            {loading ? "Salvando..." : "Salvar Alterações"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};
