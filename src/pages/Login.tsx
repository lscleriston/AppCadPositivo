import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    matricula: "",
    senha: ""
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const params = new URLSearchParams();
    params.append('username', formData.matricula);
    params.append('password', formData.senha);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/login`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        withCredentials: true // Ensure cookies are sent
      });

      if (response.data.access_token) {
        localStorage.setItem('auth_token', response.data.access_token);
        
        toast({
          title: "Login bem-sucedido!",
          description: "Redirecionando...",
        });

        if (response.data.dados_completos === false) {
          navigate("/editar-dados");
        } else {
          navigate("/dados");
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: "Matrícula ou senha incorretos. Por favor, tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-brand flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-4">
          <img src="/logo.svg" alt="Logo Positivo" className="h-14 mx-auto" />
          <div className="w-24 h-1 bg-white/30 mx-auto rounded-full"></div>
        </div>

        {/* Login Card */}
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-semibold text-foreground">
              Login Para a
            </CardTitle>
            <CardDescription className="text-lg font-medium text-muted-foreground">
              Coleta de Dados
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Matricula Field */}
              <div className="space-y-2">
                <Label htmlFor="matricula" className="text-sm font-medium text-foreground">
                  Matrícula
                </Label>
                <Input
                  id="matricula"
                  type="text"
                  placeholder="Digite sua matrícula"
                  value={formData.matricula}
                  onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                  className="h-12 bg-muted border-border focus:ring-primary focus:border-primary"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-sm font-medium text-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    className="h-12 bg-muted border-border focus:ring-primary focus:border-primary pr-12"
                    required
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-12 px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-primary hover:opacity-90 text-white font-medium text-lg shadow-primary"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            {/* Additional Links */}
            <div className="text-center space-y-2">
              <Button variant="ghost" className="text-sm text-muted-foreground hover:text-primary">
                Esqueceu sua senha?
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-white/70 text-sm">
          © 2025 Positivo S+. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};