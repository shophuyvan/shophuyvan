export function fmtVND(n){ n=Number(n||0); return n.toLocaleString('vi-VN',{style:'currency',currency:'VND'}).replace('₫','đ'); }
