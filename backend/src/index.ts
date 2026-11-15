import { config } from './config.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

createApp().listen(config.port, () => {
  console.log(`Rentaya API → http://localhost:${config.port}`);
  startScheduler();
});
