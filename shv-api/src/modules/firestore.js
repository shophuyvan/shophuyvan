export class Fire {
  constructor(env){ this.env = env; }
  // TODO: Implement SA OAuth and REST calls to Firestore via env.GOOGLE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID
  async query(col, params){ return { documents: [] }; }
  async upsert(col, id, data){ return { id, ...data }; }
  async list(col, params){ return { items: [], nextCursor: null }; }
}
