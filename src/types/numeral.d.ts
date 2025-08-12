declare module 'numeral' {
  interface Numeral {
    (value?: any): Numeral;
    format(format?: string): string;
  }
  const numeral: Numeral;
  export default numeral;
} 