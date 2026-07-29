export enum TransactionStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  VOIDED = 'voided',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
}

// Mapa de transições válidas
const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  [TransactionStatus.PENDING]: [
    TransactionStatus.AUTHORIZED,
    TransactionStatus.FAILED,
  ],
  [TransactionStatus.AUTHORIZED]: [
    TransactionStatus.CAPTURED,
    TransactionStatus.VOIDED,
  ],
  [TransactionStatus.CAPTURED]: [
    TransactionStatus.PARTIALLY_REFUNDED,
    TransactionStatus.REFUNDED,
  ],
  [TransactionStatus.PARTIALLY_REFUNDED]: [
    TransactionStatus.PARTIALLY_REFUNDED, // permite múltiplos estornos parciais
    TransactionStatus.REFUNDED,
  ],
  [TransactionStatus.FAILED]: [], // estado final
  [TransactionStatus.VOIDED]: [], // estado final
  [TransactionStatus.REFUNDED]: [], // estado final
};

export class InvalidTransitionError extends Error {
  constructor(from: TransactionStatus, to: TransactionStatus) {
    super(`Transição inválida: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertValidTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function canTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}
