/** "+212777777777" → "+212 7 77 77 77 77"; other formats are shown as typed. */
export const formatPhone = (p?: string) => {
  const m = p?.replace(/\s/g, '').match(/^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+212 ${m.slice(1).join(' ')}` : p;
};
