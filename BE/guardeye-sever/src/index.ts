import app from "./app";
import { connectDB } from "./shared/config/db";
import { ENV } from "./shared/config/env";

const start = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  });
};

start();
