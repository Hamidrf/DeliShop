const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian/Arabic-Indic digits to plain Latin ones, leaves everything else alone. */
function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, ch => {
    const persianIdx = PERSIAN_DIGITS.indexOf(ch);
    if (persianIdx !== -1) return String(persianIdx);
    return String(ARABIC_DIGITS.indexOf(ch));
  });
}

/**
 * Normalizes an Iranian mobile number to the `09XXXXXXXXX` shape (11 digits).
 * Accepts `+98`, `0098` and bare `9…` prefixes, and Persian/Arabic digits.
 * Returns null if the result isn't a valid-looking mobile number.
 */
export function normalizePhone(input: string): string | null {
  let digits = toLatinDigits(input).replace(/\D/g, '');
  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98')) digits = digits.slice(2);
  if (digits.startsWith('9') && digits.length === 10) digits = '0' + digits;
  if (digits.length !== 11 || !digits.startsWith('09')) return null;
  return digits;
}
