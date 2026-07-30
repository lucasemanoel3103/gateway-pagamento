export function shouldSimulateFailure(
  amount: number,
  cardLast4: string,
): boolean {
  // Regra 1: valores acima de R$ 10.000,00 (1_000_000 centavos) sempre falham
  if (amount > 1_000_000) {
    return true;
  }

  // Regra 2: cartões terminados em "0000" simulam recusa (saldo insuficiente)
  if (cardLast4 === '0000') {
    return true;
  }

  return false;
}
