import app from "./app";
import { connectDB } from "./shared/config/db";
import { ENV } from "./shared/config/env";
import { startAutoResumeJob } from "./features/devices/devices.scheduler";

const start = async () => {
  await connectDB();
  startAutoResumeJob();
  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  });
};

start();
