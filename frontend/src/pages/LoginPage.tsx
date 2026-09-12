import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Fingerprint,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/session';
import { Brand } from '../components/ui';
import type { Role } from '../types';

export default function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const enter = (role: Role) => {
    login(role);
    navigate(role === 'ADVOGADO' ? '/processos' : '/admin/overview');
  };
  return (
    <div className="login-page">
      <div className="login-story">
        <header>
          <Brand />
          <span className="login-edition">ENTER × UNICAMP</span>
        </header>
        <div className="login-story-content">
          <div className="eyebrow">
            <span className="accent-square" />
            POLÍTICA DE ACORDOS, COM INTELIGÊNCIA
          </div>
          <h1>
            Mais contexto.
            <br />
            Melhores
            <br />
            <span>decisões jurídicas.</span>
          </h1>
          <p>
            Da evidência à decisão, uma visão clara
            <br className="desktop-only" /> de cada processo.
          </p>
          <div className="login-principles">
            <span>
              <Check size={14} /> Evidências rastreáveis
            </span>
            <span>
              <Check size={14} /> Decisão humana
            </span>
          </div>
        </div>
        <div className="login-proof">
          <div className="proof-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <strong>O que sustenta uma boa decisão?</strong>
            <p>Os fatos certos. A fonte acessível. A política à vista.</p>
          </div>
          <ArrowUpRight size={23} />
        </div>
        <footer>
          <span>UM NOVO OLHAR PARA O CONTENCIOSO.</span>
          <span>2026</span>
        </footer>
      </div>
      <div className="login-access">
        <div className="login-access-top">
          <span className="pill-neutral">
            <span className="demo-indicator" />
            Ambiente de demonstração
          </span>
        </div>
        <div className="login-access-content">
          <div className="access-icon">
            <Fingerprint size={27} strokeWidth={1.4} />
          </div>
          <div className="eyebrow">BEM-VINDO À SUA NOVA MESA DE TRABALHO</div>
          <h2>
            Um espaço para
            <br />
            cada perspectiva.
          </h2>
          <p className="login-intro">Escolha seu perfil para explorar a plataforma.</p>
          <button className="role-card role-lawyer" onClick={() => enter('ADVOGADO')}>
            <span className="role-icon">
              <Scale size={25} strokeWidth={1.6} />
            </span>
            <span className="role-copy">
              <strong>Entrar como Advogado</strong>
              <span>Analise evidências e decida com clareza.</span>
            </span>
            <ArrowRight size={21} />
          </button>
          <button className="role-card" onClick={() => enter('ADMINISTRATIVO')}>
            <span className="role-icon">
              <BriefcaseBusiness size={24} strokeWidth={1.6} />
            </span>
            <span className="role-copy">
              <strong>Entrar como Administrativo</strong>
              <span>Acompanhe a política e seus resultados.</span>
            </span>
            <ArrowRight size={21} />
          </button>
          <div className="login-note">
            <ShieldCheck size={15} />
            <p>
              Acesso demonstrativo. Os dados são fictícios e os registros desta experiência ficam
              neste navegador.
            </p>
          </div>
        </div>
        <footer>
          <span>BANCO UNICAMP</span>
          <span>Protótipo para o Hackathon Enter × Unicamp</span>
        </footer>
      </div>
    </div>
  );
}
