/* SHV safe patch header */
export const jtAdapter = {
  async quote(ctx){ return []; },
  async create(ctx){ return { tracking_code:'', fee:0, eta:'' }; },
  async cancel(ctx){ return { ok:true }; }
};
