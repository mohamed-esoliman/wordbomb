import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);
const { httpServer, dictionary } = createApp();

httpServer.listen(port, () => {
  console.log(`wordbomb server listening on http://localhost:${port} (${dictionary.size} words)`);
});
