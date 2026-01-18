declare module "openid-client/passport" {
  import type { Strategy as PassportStrategy, AuthenticateCallback } from "passport";
  import type * as client from "openid-client";

  export type VerifyFunction = (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: AuthenticateCallback
  ) => void | Promise<void>;

  export class Strategy extends PassportStrategy {
    constructor(
      options: {
        name?: string;
        config: client.Configuration;
        scope: string;
        callbackURL?: string;
      },
      verify: VerifyFunction
    );
    name: string;
  }
}
