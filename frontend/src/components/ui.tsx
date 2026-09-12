import type { ButtonHTMLAttributes, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Check, Circle, LoaderCircle, ShieldCheck, X } from 'lucide-react';

const labels: Record<string, string> = {
  ACORDO: 'Acordo',
  DEFESA: 'Defesa',
  REVISAR: 'Revisar',
  ALTO: 'Alto risco',
  MEDIO: 'Médio risco',
  BAIXO: 'Baixo risco',
  AGUARDANDO_DECISAO: 'Aguardando decisão',
  EM_NEGOCIACAO: 'Em negociação',
  DECISAO_REGISTRADA: 'Decisão registrada',
  CONCLUIDO: 'Concluído',
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  INCONCLUSIVO: 'Inconclusivo',
  PENDENTE: 'Pendente',
  ACEITA: 'Aceita',
  ACEITO: 'Aceito',
  RECUSADA: 'Recusada',
  RECUSADO: 'Recusado',
  CONTRAPROPOSTA: 'Contraproposta',
  ADERENTE: 'Aderente',
  OVERRIDE: 'Override',
  DEMO: 'Demo data',
  SIMULACAO: 'Simulação',
  LOCAL: 'Nesta demo',
};
export function Badge({
  value,
  children,
  className = '',
}: {
  value: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`badge badge-${value.toLowerCase()} ${className}`}>
      <span className="badge-dot" />
      {children || labels[value] || value}
    </span>
  );
}
export function Button({
  children,
  variant = 'primary',
  loading,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`button ${variant} ${className}`}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Brand({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <div
      className={`brand ${inverse ? 'brand-inverse' : ''}`}
      aria-label="Enter Policy — protótipo Hackathon"
    >
      <img className="brand-logo" src="/enter-logo-full.svg" alt="" aria-hidden="true" />
      {!compact && (
        <>
          <span className="brand-divider" />
          <span className="brand-module">policy</span>
        </>
      )}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${className}`}>
          <div className="modal-header">
            <div>
              <Dialog.Title className="modal-title">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'modal-description' : 'sr-only'}>
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Fechar janela">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>Preparando sua mesa de trabalho…</span>
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle size={30} />
      <h2>Não foi possível carregar os dados</h2>
      <p>{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
export function Notice({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const Icon = tone === 'success' ? Check : tone === 'warning' ? AlertCircle : Circle;
  return (
    <div className={`notice notice-${tone}`} role={tone === 'success' ? 'status' : undefined}>
      <Icon size={16} />
      <span>{children}</span>
    </div>
  );
}
export function Provenance({ policy, model }: { policy: string; model: string }) {
  return (
    <div className="provenance">
      <ShieldCheck size={13} />
      <span>
        Política {policy} · Modelo {model}
      </span>
    </div>
  );
}
