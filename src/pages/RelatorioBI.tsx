import { useEffect, useRef } from "react";
import { Header } from "@/components/Layout/Header";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Loader2, UserX } from "lucide-react";
import axios from "axios";
import * as pbi from 'powerbi-client';

export const RelatorioBI = () => {
    const { isAdmin, loading: adminCheckLoading } = useIsAdmin();
    const reportContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (adminCheckLoading || !isAdmin || !reportContainerRef.current) {
            return;
        }

        const loadReport = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/relatorio_bi/get_embed_config`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const embedConfig = response.data;

                if (embedConfig.status !== 'success') {
                    console.error('Error fetching embed config:', embedConfig.message);
                    return;
                }

                const reportConfig: pbi.models.IEmbedConfiguration = {
                    type: 'report',
                    tokenType: pbi.models.TokenType.Embed,
                    accessToken: embedConfig.embedToken,
                    embedUrl: embedConfig.embedUrl,
                    id: embedConfig.reportId,
                    settings: {
                        panes: {
                            filters: { expanded: false, visible: true },
                            pageNavigation: { visible: true, position: pbi.models.PageNavigationPosition.Bottom }
                        }
                    }
                };

                const powerbi = new pbi.service.Service(pbi.factories.hpmFactory, pbi.factories.wpmpFactory, pbi.factories.routerFactory);
                
                if(reportContainerRef.current) {
                    powerbi.embed(reportContainerRef.current, reportConfig);
                }

            } catch (error) {
                console.error("Failed to load Power BI report", error);
            }
        };

        loadReport();

    }, [adminCheckLoading, isAdmin]);

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
        <div className="min-h-screen flex flex-col">
            <Header />
            <div ref={reportContainerRef} style={{ flexGrow: 1, height: 'calc(100vh - 72px)' }} />
        </div>
    );
};
