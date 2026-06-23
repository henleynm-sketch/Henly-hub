import type { ApiKey } from "@repo/db";
import type { Scope } from "@repo/services";

// Properties attached to the request by our middleware (auth, scope, logging).
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      scopes?: Scope[];
      requiredScope?: Scope;
    }
  }
}

export {};
