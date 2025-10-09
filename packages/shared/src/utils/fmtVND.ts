export function fmtVND(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  // keep 'đ' like your web
  return v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }).replace('₫','đ');
}
