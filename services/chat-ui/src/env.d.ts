export type PixieRuntimeEnv = {
  API_BASE_URL?: string;
};

declare global {
  interface Window {
    __ENV__?: PixieRuntimeEnv;
  }
}

export {};
