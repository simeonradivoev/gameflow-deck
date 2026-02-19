import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './drizzle',
    schema: './src/bun/api/schema/app.ts',
    dialect: 'sqlite',
    dbCredentials: {
        url: "./games.db"
    }
});