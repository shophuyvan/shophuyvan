import { onRequest as __facebook_feed_csv_js_onRequest } from "E:\\WEB\\Zaliminiapp-web\\shophuyvan\\apps\\fe\\functions\\facebook-feed.csv.js"
import { onRequest as __hello_txt_js_onRequest } from "E:\\WEB\\Zaliminiapp-web\\shophuyvan\\apps\\fe\\functions\\hello.txt.js"

export const routes = [
    {
      routePath: "/facebook-feed.csv",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__facebook_feed_csv_js_onRequest],
    },
  {
      routePath: "/hello.txt",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__hello_txt_js_onRequest],
    },
  ]