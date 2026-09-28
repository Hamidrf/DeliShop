const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian/Arabic-Indic digits to plain Latin ones; leaves everything else (spaces, `+`) alone. */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, ch => {
    const persianIdx = PERSIAN_DIGITS.indexOf(ch);
    if (persianIdx !== -1) return String(persianIdx);
    return String(ARABIC_DIGITS.indexOf(ch));
  });
}
