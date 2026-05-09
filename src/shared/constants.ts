export const LOGIN_PORT = 5196;
export const OAUTH_REDIRECT_PORT = 5194;
export const SERVER_PORT = 5173;
export const EMULATORJS_PORT = 5176;
export const SERVER_URL = (host: string) => `http://${host}:${SERVER_PORT}`;
export const WINDOW_PORT = 4656;
export const RPC_PORT = 8787;
export const RPC_URL = (host: string) => `http://${host}:${RPC_PORT}`;
export const EMULATORJS_URL = (host: string) => `http://${host}:${EMULATORJS_PORT}`;
export const SOCKETS_URL = (host: string) => `ws://${host}:${RPC_PORT}`;

export const DefaultRommStaleTime = 60 * 1000; // A minute
export const PluginRegistry = process.env.STORE_REGISTRY ?? "https://registry.npmjs.org";