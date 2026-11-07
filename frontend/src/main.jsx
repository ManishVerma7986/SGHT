
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import './index.css'
import App from './App.jsx'

const appId = import.meta.env.VITE_PRIVY_APP_ID

if (!appId) {
  throw new Error('Missing VITE_PRIVY_APP_ID in frontend/.env')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'passkey'],
        appearance: {
          theme: 'light',
          accentColor: '#2563eb',
          landingHeader: 'Welcome to SHGT',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
