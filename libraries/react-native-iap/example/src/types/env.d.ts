declare module '@env' {
  export const AMAZON_RVS_SANDBOX: string;
  export const AMAZON_EXPECTED_ENVIRONMENT:
    | 'Sandbox'
    | 'Production'
    | undefined;
  export const IAPKIT_API_KEY: string;
  export const IAPKIT_BASE_URL: string;
}
