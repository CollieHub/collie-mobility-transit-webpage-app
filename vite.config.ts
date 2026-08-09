import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'
import path from 'path'

const keyPath = path.resolve(__dirname, './localhost-key.pem')
const certPath = path.resolve(__dirname, './localhost.pem')

const hasCustomCert = fs.existsSync(keyPath) && fs.existsSync(certPath)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      ...(!hasCustomCert ? [basicSsl()] : [])
    ],
    build: {
      rolldownOptions: {
        output: {
          minify: env.VITE_DROP_CONSOLE === 'true' ? {
            compress: {
              dropConsole: true,
            },
          } : undefined,
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      ...(hasCustomCert ? {
        https: {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      } : {})
    }
  }
})
