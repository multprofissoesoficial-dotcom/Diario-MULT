import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Rocket, ShieldCheck, Database } from "lucide-react";

export default function SeedMaster() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const runSeed = async () => {
    setLoading(true);
    setStatus("Iniciando processo de inicialização...");

    try {
      // 1. Criar/Logar Usuário Master PRIMEIRO
      const masterEmail = "faustodv@gmail.com";
      const masterPass = "123mudar";

      setStatus("Autenticando usuário Master...");
      let user;
      try {
        const userCred = await signInWithEmailAndPassword(auth, masterEmail, masterPass);
        user = userCred.user;
        setStatus("Usuário Master logado.");
      } catch (e) {
        setStatus("Criando usuário Master...");
        const userCred = await createUserWithEmailAndPassword(auth, masterEmail, masterPass);
        user = userCred.user;
        setStatus("Usuário Master criado.");
      }

      // 2. Garantir Perfil no Firestore
      setStatus("Verificando perfil no Firestore...");
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: "Fausto Master",
        email: masterEmail,
        role: "master",
        xp: 0,
        unlockedBadges: [],
        createdAt: new Date().toISOString()
      }, { merge: true });
      setStatus("Perfil Master garantido.");

      // 3. Criar Franquias Iniciais
      const franquiasRef = collection(db, "franquias");
      const snapshot = await getDocs(franquiasRef);
      
      if (snapshot.empty) {
        setStatus("Criando franquias iniciais...");
        const f1 = { id: "rio-verde", nome: "Rio Verde", cidade: "Rio Verde", createdAt: new Date().toISOString() };
        const f2 = { id: "aparecida", nome: "Aparecida de Goiânia", cidade: "Aparecida de Goiânia", createdAt: new Date().toISOString() };
        
        await setDoc(doc(db, "franquias", f1.id), f1);
        await setDoc(doc(db, "franquias", f2.id), f2);
        setStatus("Franquias criadas com sucesso.");
      }

      // 4. Criar Cursos Iniciais
      setStatus("Criando cursos iniciais...");
      const courses = [
        {
          id: "INF",
          title: "Informática Profissional",
          modules: [
            { name: "Introdução", lessons: [{ num: 1, title: "Primeiros Passos" }] }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "AAS",
          title: "Assistente Administrativo e Secretariado",
          modules: [
            { 
              name: "Assistente Administrativo", 
              lessons: Array.from({ length: 9 }, (_, i) => ({ num: i + 1, title: `Aula ${i + 1}` })) 
            },
            { 
              name: "Secretariado", 
              lessons: Array.from({ length: 10 }, (_, i) => ({ num: i + 10, title: `Aula ${i + 10}` })) 
            },
            { 
              name: "Departamento Pessoal", 
              lessons: Array.from({ length: 11 }, (_, i) => ({ num: i + 20, title: `Aula ${i + 20}` })) 
            },
            { 
              name: "RH", 
              lessons: Array.from({ length: 2 }, (_, i) => ({ num: i + 31, title: `Aula ${i + 31}` })) 
            },
            { 
              name: "Contabilidade", 
              lessons: Array.from({ length: 8 }, (_, i) => ({ num: i + 33, title: `Aula ${i + 33}` })) 
            }
          ],
          createdAt: new Date().toISOString()
        }
      ];

      for (const course of courses) {
        await setDoc(doc(db, "courses", course.id), course);
      }
      setStatus("Cursos criados com sucesso.");

      setStatus("SEED CONCLUÍDO COM SUCESSO!");

    } catch (err: any) {
      console.error(err);
      setStatus("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cockpit-bg flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto neon-glow-blue">
          <ShieldCheck className="text-neon-blue w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tighter">INICIALIZAÇÃO <span className="text-neon-blue">MESTRE</span></h1>
        <p className="text-gray-400 text-sm">
          Este script irá configurar as franquias iniciais e o acesso Master global.
        </p>
        
        <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-xs font-mono text-left h-32 overflow-y-auto">
          {status || "Aguardando comando..."}
        </div>

        <button
          onClick={runSeed}
          disabled={loading}
          className="w-full bg-neon-blue text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-neon-blue/90 transition-all disabled:opacity-50"
        >
          <Database className="w-5 h-5" />
          {loading ? "EXECUTANDO..." : "EXECUTAR SEED"}
        </button>
        
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">
          Apenas para o primeiro acesso do sistema
        </p>
      </div>
    </div>
  );
}
