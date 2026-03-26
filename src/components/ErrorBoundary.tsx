"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado no sistema.";
      
      try {
        // Try to parse if it's our custom Firestore error
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) {
          if (parsed.error.includes("insufficient permissions")) {
            errorMessage = "Você não tem permissão para acessar estes dados. Verifique seu nível de acesso.";
          } else {
            errorMessage = `Erro no banco de dados: ${parsed.error}`;
          }
        }
      } catch (e) {
        // Not a JSON error, use default
      }

      return (
        <div className="min-h-screen bg-cockpit-bg flex items-center justify-center p-6 text-center">
          <div className="glass-card p-8 max-w-md space-y-6 border-red-500/30">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle className="text-red-500 w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">ALERTA DE SISTEMA</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-mult-orange text-white font-black rounded-xl neon-glow-orange transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> REINICIAR SISTEMA
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
