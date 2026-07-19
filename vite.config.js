import { defineConfig } from 'vite';
import os from 'os';
import qrcode from 'qrcode-terminal';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  define: {
    __LOCAL_IP__: JSON.stringify(getLocalIP())
  },
  plugins: [
    {
      name: 'vite-plugin-console-qrcode',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const ip = getLocalIP();
          const url = `http://${ip}:5173`;
          console.log('\n\x1b[35m%s\x1b[0m', '==================================================');
          console.log('\x1b[36m%s\x1b[0m', '   LifeSync 2.0 - Personal AI OS Dev Server');
          console.log('\x1b[35m%s\x1b[0m', '==================================================');
          console.log(`\nLocal Network Address: \x1b[4m${url}\x1b[0m`);
          console.log('Scan the QR code below to connect your mobile device:\n');
          qrcode.generate(url, { small: true });
          console.log('\x1b[35m%s\x1b[0m', '==================================================\n');
        });
      }
    }
  ]
});
