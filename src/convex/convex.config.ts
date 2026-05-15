import { defineApp } from 'convex/server';
import betterAuth from './_components/better_auth/convex.config';

const app = defineApp();
app.use(betterAuth);

export default app;
