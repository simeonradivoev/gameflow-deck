
import { createClient } from '@hey-api/openapi-ts';

createClient({
  input: './scripts/romm/openapi.json', // sign up at app.heyapi.dev
  output: './src/clients/romm',
  plugins: ['@tanstack/react-query', '@hey-api/client-fetch', '@hey-api/typescript'],
});