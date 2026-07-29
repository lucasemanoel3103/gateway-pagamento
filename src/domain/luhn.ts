export function isValidLuhn(cardNumber: string): boolean {
  const digitsOnly = cardNumber.replace(/\D/g, '');

  if (digitsOnly.length < 13 || digitsOnly.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = parseInt(digitsOnly[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
