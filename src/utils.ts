export const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const cleanCPF = (value: string | null | undefined) => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

export const formatPhone = (value: string) => {
  const v = value.replace(/\D/g, '');
  if (v.length <= 2) return v;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
};

export const cleanPhone = (value: string | null | undefined) => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};
