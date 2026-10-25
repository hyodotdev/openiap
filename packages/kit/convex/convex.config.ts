import { defineApp } from "convex/server";
import migrations from "@convex-dev/migrations/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(migrations);
app.use(rateLimiter);

export default app;
