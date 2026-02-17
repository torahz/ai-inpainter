
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: Se o seu repositório no GitHub se chama "meu-projeto", 
  // a base deve ser '/meu-projeto/'. Se for o repositório principal (username.github.io), use '/'.
  base: './', 
})
