import { BIND_HOST, createServer } from './app.mjs';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be an integer from 0 to 65535.');
  process.exit(1);
}

const server = createServer();
server.listen(port, BIND_HOST, () => {
  const address = server.address();
  if (!address || typeof address === 'string') {
    console.error('The mock did not bind a TCP port.');
    process.exit(1);
  }
  console.log(`Lumen Relay mock listening on http://${address.address}:${address.port}`);
});
