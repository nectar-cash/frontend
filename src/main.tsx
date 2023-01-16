import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ConnectKitProvider, getDefaultClient } from 'connectkit'
import { configureChains, createClient, WagmiConfig } from 'wagmi'
import { goerli } from 'wagmi/chains' // hardhat
import { infuraProvider } from 'wagmi/providers/infura'
// import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'

import './index.css'
import 'react-tooltip/dist/react-tooltip.css'

const { chains, provider } = configureChains(
  [goerli], // hardhat,
  [
    //@ts-ignore
    infuraProvider({ apiKey: import.meta.env.VITE_INFURA_KEY }),
    // jsonRpcProvider({
    //   rpc: (chain) => {
    //     return { http: 'http://127.0.0.1:8545/' }
    //   },
    // }),
  ]
)

const client = createClient(
  getDefaultClient({
    appName: 'Nectar',
    autoConnect: true,
    chains,
    provider,
  })
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WagmiConfig client={client}>
      <ConnectKitProvider options={{ hideQuestionMarkCTA: true, hideNoWalletCTA: true }} theme="retro">
        <App />
      </ConnectKitProvider>
    </WagmiConfig>
  </React.StrictMode>
)
