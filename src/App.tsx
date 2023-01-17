import React, { useEffect, useState } from 'react'
import { ConnectKitButton, useModal } from 'connectkit'
import { useAccount, useBalance, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi'
import { ethers } from 'ethers'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { Tooltip } from 'react-tooltip'

import NectarVaultABI from './NectarVaultABI'
import './App.css'

import nectarLogo from './assets/logo.svg'

import imageMetamaskSettings from './assets/MetaMaskSettings.png'
import imageNetworks from './assets/Networks.png'
import imageAddNetwork from './assets/AddNetwork.png'
import imageAddManually from './assets/AddManually.png'
import imageNetworkSettings from './assets/NetworkSettings.png'
import imageSwitchNetwork from './assets/SwitchNetwork.png'

const contractAddress = '0x328E07B5b09a8c9e01A849C8d8f246d56ed3ec75'
const contractABI = NectarVaultABI

function InlineStatus({ status, children }: { status: boolean; children: React.ReactNode }) {
  return (
    <>
      {status ? '✅ ' : ' '}
      <span className={`${status ? 'line-through text-stone-400' : ''}`}>{children}</span>
    </>
  )
}

function App() {
  let userAddress: `0x${string}` | undefined
  const { address: userAddressOut, isConnecting, isDisconnected, isConnected } = useAccount()
  userAddress = userAddressOut
  const {
    data: userBalance,
    isError: balanceIsError,
    isLoading: balanceIsLoading,
  } = useBalance({ address: userAddress, watch: true, enabled: userAddress !== undefined })

  const { setOpen: setConnectModalOpen } = useModal()

  const [currentTimestamp, setCurrentTimestamp] = useState(Math.floor(Date.now() / 1000))

  const [withdrawalDone, setWithdrawalDone] = useState(false)
  const [userTx, setUserTx] = useState('')
  const [userTxIncluded, setUserTxIncluded] = useState(false)
  const [depositTx, setDepositTx] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const { data: userFunds, isFetched: userFundsFetched } = useContractRead({
    address: contractAddress,
    abi: contractABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    enabled: isConnected && userAddress !== undefined,
    watch: true,
  })

  const withdrawAllEnabled = userFunds ? userFunds.gt(0) : false
  const { config: withdrawAllConfig, error: withdrawAllError } = usePrepareContractWrite({
    address: contractAddress,
    abi: contractABI,
    functionName: 'withdraw',
    enabled: withdrawAllEnabled,
  })
  const { write: withdrawAllWrite } = useContractWrite({
    ...withdrawAllConfig,
    onSuccess: () => {
      setWithdrawalDone(true)
    },
  })

  // const addNectarGoerliNetwork = () => {
  //   window.ethereum.request({
  //     method: 'wallet_addEthereumChain',
  //     params: [
  //       {
  //         chainId: '0x5',
  //         rpcUrls: ['http://localhost:11010'],
  //         chainName: 'Goerli via Nectar',
  //         nativeCurrency: {
  //           name: 'GoerliETH',
  //           symbol: 'GoerliETH',
  //           decimals: 18,
  //         },
  //         blockExplorerUrls: ['https://goerli.etherscan.io/'],
  //       },
  //     ],
  //   })
  // }

  // WS

  //@ts-ignore
  const connectionAddress = import.meta.env.PROD ? 'wss://api.nectar.cash' : 'ws://localhost:11012'
  const connectionURL = isConnected ? `${connectionAddress}/follow?address=${userAddress!}` : ''

  // const [socketUrl, setSocketUrl] = useState(connectionURL)
  const [messageHistory, setMessageHistory] = useState<
    {
      source: string
      message: string
    }[]
  >([])

  const { lastMessage, readyState } = useWebSocket(connectionURL)

  const [eventReceivedRPCReceived, setEventReceivedRPCReceived] = useState(false)
  const [eventReceivedSentAuction, setEventReceivedSentAuction] = useState(false)
  const [eventReceivedSentSearcher, setEventReceivedSentSearcher] = useState(false)
  const [eventReceivedBundleBuilt, setEventReceivedBundleBuilt] = useState(false)
  const [eventReceivedBidSent, setEventReceivedBidSent] = useState(false)
  const [eventReceivedAuctionConcluded, setEventReceivedAuctionConcluded] = useState(false)
  const [eventReceivedRPCBundleReceived, setEventReceivedRPCBundleReceived] = useState(false)
  const [eventReceivedRPCBundlePublished, setEventReceivedRPCBundlePublished] = useState(false)
  const [eventReceivedBundleFound, setEventReceivedBundleFound] = useState(false)
  const [eventReceivedDepositIncluded, setEventReceivedDepositIncluded] = useState(false)

  const stringMatchesToToggles: { [search: string]: React.Dispatch<React.SetStateAction<boolean>> } = {
    'Received tx': setEventReceivedRPCReceived,
    'to auction': setEventReceivedSentAuction,
    'Starting auction': setEventReceivedSentSearcher,
    'strategy formed': setEventReceivedBundleBuilt,
    'Sent the bid': setEventReceivedBidSent,
    'with winning bid': setEventReceivedAuctionConcluded,
    'Received winning auction bundle': setEventReceivedRPCBundleReceived,
    'in a Flashbots-built block': setEventReceivedRPCBundlePublished,
    'Payment to Auction': setEventReceivedBundleFound,
    'ETH included in the block': setEventReceivedDepositIncluded,
  }

  useEffect(() => {
    if (lastMessage !== null) {
      const parsedMessage: string = JSON.parse(lastMessage.data)?.message
      const parts = parsedMessage.split(': ')
      let msg = ''
      if (parts.length > 1 && typeof parts[1] === 'string') {
        msg = parts[1]
        for (const matchString of Object.keys(stringMatchesToToggles)) {
          if (msg.includes(matchString)) {
            stringMatchesToToggles[matchString](true)
          }
        }

        if (msg.includes('Flashbots-built block')) {
          const addressMatches = msg.match(/0x([0-9a-fA-F]{64})/g)
          if (addressMatches && addressMatches.length > 0) {
            setUserTx(addressMatches[0])
            setUserTxIncluded(true)
          }
        }

        if (msg.includes('ETH included in the block')) {
          const addressMatches = msg.match(/0x([0-9a-fA-F]{64})/g)
          if (addressMatches && addressMatches.length > 0) {
            setDepositTx(addressMatches[0])
          }
        }

        msg = msg.replace(/(0x[0-9a-fA-F]{64})/g, (_match, p1) => {
          return `${p1.slice(0, 6)}····${p1.slice(-4)}`
        })
        msg = msg.replace(/(0x[0-9a-fA-F]{40})/g, (_match, p1) => {
          return `${p1.slice(0, 6)}····${p1.slice(-4)}`
        })
      }
      setMessageHistory((prev) =>
        prev.concat([
          {
            source: parts[0],
            message: msg,
          },
        ])
      )
    }
  }, [lastMessage, setMessageHistory])

  // const handleClickChangeSocketUrl = useCallback(
  //   () => setSocketUrl('wss://demos.kaazing.com/echo'),
  //   []
  // );

  // const handleClickSendMessage = useCallback(() => sendMessage('Hello'), [])

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState]

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const tooltipStyle = {
    opacity: 1,
    padding: 0,
    overflow: 'clip',
    borderRadius: '12px',
    boxShadow: '0 3px 12px rgba(0,0,0,0.4)',
  }

  // UI

  return (
    <div className="App">
      <div className="bg-[#325444] pb-32">
        <div className="p-8 flex align-middle mx-auto justify-between max-w-4xl">
          {/* <h1 className={`text-3xl font-bold text-[#CFFC0D] bg-[url('${nectarLogo}') bg-contain]`}>Nectar</h1> */}
          <img src={nectarLogo} />
          <ConnectKitButton showAvatar={true} showBalance={true} />
        </div>
      </div>

      {/* <h2 className="text-2xl text-orange-900 font-bold mt-4">Steps</h2> */}

      <div className="max-w-4xl rounded-2xl bg-stone-50 p-8 mx-auto -mt-32 mb-16">
        <div className="prose prose-base prose-stone max-w-none">
          <p>
            Hi! This is the Nectar system demo. You can add a custom RPC to your wallet and execute a Uniswap trade. It
            will get you backrun with an arbitrage, and the rewards from that will get deposited to the Nectar Vault for
            your address. You can then withdraw the reward.
          </p>

          <h2 className="mt-8 flex align-middle font-medium text-2xl">
            <span className="block rounded-full shadow-lg bg-orange-600 text-orange-100 h-8 w-8 text-center mr-4">
              1
            </span>
            Add Nectar RPC
          </h2>
          <p>
            Nectar needs to receive your transactions to be able to auction them. MetaMask doesn’t allow quickly adding
            additional configurations for existing networks, so it has to be done manually:
          </p>

          <ol>
            <li>
              Go to{' '}
              <span id="metamask-settings" className="underline underline-offset-4 decoration-dotted cursor-help">
                MetaMask Settings
              </span>
              .
            </li>
            <Tooltip
              noArrow
              anchorId="metamask-settings"
              style={tooltipStyle}
              html={`<img class="w-60 p-0 m-0 opacity-100" src='${imageMetamaskSettings}' />`}
            />
            <li>
              Go to{' '}
              <span id="metamask-networks" className="underline underline-offset-4 decoration-dotted cursor-help">
                Networks
              </span>
              .
            </li>
            <Tooltip
              noArrow
              anchorId="metamask-networks"
              style={tooltipStyle}
              html={`<img class="w-60 p-0 m-0 opacity-100" src='${imageNetworks}' />`}
            />
            <li>
              Click{' '}
              <span id="add-network" className="underline underline-offset-4 decoration-dotted cursor-help">
                “Add Network”
              </span>
              .
            </li>
            <Tooltip
              noArrow
              anchorId="add-network"
              style={tooltipStyle}
              html={`<img class="w-60 p-0 m-0 opacity-100" src='${imageAddNetwork}' />`}
            />
            <li>
              Click{' '}
              <span id="add-manually" className="underline underline-offset-4 decoration-dotted cursor-help">
                “Add a network manually”
              </span>
              .
            </li>
            <Tooltip
              noArrow
              anchorId="add-manually"
              style={tooltipStyle}
              html={`<img class="w-[32rem] p-0 m-0 opacity-100" src='${imageAddManually}' />`}
            />
            <li>Use the following values:</li>
            <ul className="grid grid-cols-[1fr_2fr] m-0 p-0 list-none">
              <li className="m-1">Network name</li>
              <li className="m-1">
                <span
                  id="network-name"
                  className="font-mono cursor-pointer"
                  onClick={() => copyText('Goerli via Nectar')}
                >
                  Goerli via Nectar
                </span>
                <Tooltip noArrow anchorId="network-name" content="Click to copy" place="top" />
              </li>

              <li className="m-1">New RPC URL</li>
              <li className="m-1">
                <span
                  id="rpc-url"
                  className="font-mono cursor-pointer"
                  onClick={() => copyText('https://rpc-goerli.nectar.cash')}
                >
                  https://rpc-goerli.nectar.cash
                </span>
                <Tooltip noArrow anchorId="rpc-url" content="Click to copy" place="top" />
              </li>
              <li className="m-1">Chain ID</li>
              <li className="m-1">
                <span id="chain-id" className="font-mono cursor-pointer" onClick={() => copyText('5')}>
                  5
                </span>
                <Tooltip noArrow anchorId="chain-id" content="Click to copy" place="top" />
              </li>
              <li className="m-1">Currency symbol</li>
              <li className="m-1">
                <span id="currency-symbol" className="font-mono cursor-pointer" onClick={() => copyText('GoerliETH')}>
                  GoerliETH
                </span>
                <Tooltip noArrow anchorId="currency-symbol" content="Click to copy" place="top" />
              </li>
              <li className="m-1">Block explorer URL</li>
              <li className="m-1">
                <span
                  id="block-explorer"
                  className="font-mono cursor-pointer"
                  onClick={() => copyText('https://goerli.etherscan.io')}
                >
                  https://goerli.etherscan.io
                </span>
                <Tooltip noArrow anchorId="block-explorer" content="Click to copy" place="top" />
              </li>
            </ul>
            <li>
              Click{' '}
              <span id="save-network" className="underline underline-offset-4 decoration-dotted cursor-help">
                “Save”
              </span>
              .
            </li>
            <Tooltip
              noArrow
              anchorId="save-network"
              style={tooltipStyle}
              html={`<img class="w-[32rem] p-0 m-0 opacity-100" src='${imageNetworkSettings}' />`}
            />
            <li>
              <span id="switch-network" className="underline underline-offset-4 decoration-dotted cursor-help">
                Switch to “Goerli via Nectar” network
              </span>
              .
            </li>
            <Tooltip
              noArrow
              anchorId="switch-network"
              style={tooltipStyle}
              html={`<img class="w-60 p-0 m-0 opacity-100" src='${imageSwitchNetwork}' />`}
            />
            {!isConnected && (
              <li>
                Make sure to{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setConnectModalOpen(true)
                  }}
                >
                  connect your wallet
                </a>{' '}
                — that’s how you’ll be able to follow events later.
              </li>
            )}
          </ol>

          <h2 className="mt-8 flex align-middle font-medium text-2xl">
            <span className="block rounded-full shadow-lg bg-orange-600 text-orange-100 h-8 w-8 text-center mr-4">
              2
            </span>
            Execute a Uniswap Swap
          </h2>

          <p>
            You will buy NTT (meaningless Nectar Test Token) for GoerliETH. If you don’t have GoerliETH, there are a{' '}
            <a href="https://goerli-faucet.pk910.de/">couple</a> <a href="https://faucet.quicknode.com/drip">of</a>{' '}
            <a href="https://goerlifaucet.com/">faucets</a>, or feel free to{' '}
            <a href="https://t.me/lekevicius">ping me on Telegram</a> to get some.
          </p>

          <ol>
            <li>
              Go to{' '}
              <a
                href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x30eFdDeC56bE2987Bf5902cE791425465266E839&exactAmount=0.1&exactField=input"
                target="_blank"
              >
                Uniswap app
              </a>
              . This link should have set all the fields right, if not:
            </li>
            <ol>
              <li>
                Click “Select token” and enter the address of our Nectar Test Token NTT:{' '}
                <span
                  id="token-address"
                  className="font-mono cursor-pointer"
                  onClick={() => copyText('0x30eFdDeC56bE2987Bf5902cE791425465266E839')}
                >
                  0x30eFdDeC56bE2987Bf5902cE791425465266E839
                </span>
                <Tooltip noArrow anchorId="token-address" content="Click to copy" place="top" />.
              </li>
              <li>Enter 0.1 ETH into the top field, as the sold currency.</li>
            </ol>
            <li>
              Click <strong>“Swap”</strong> and sign the transaction,{' '}
              <em>double-checking to use “Goerli via Nector” network</em>.
            </li>
          </ol>

          <h2 className="mt-8 flex align-middle font-medium text-2xl">
            <span className="block rounded-full shadow-lg bg-orange-600 text-orange-100 h-8 w-8 text-center mr-4">
              3
            </span>
            Follow the events
          </h2>

          {!isConnected && (
            <p className="p-4 bg-orange-50 border-orange-600 border-[1px] rounded-lg text-orange-700">
              <strong className="text-orange-800">Your wallet is not connected!</strong> You can only receive events
              about your wallet transactions. Make sure to{' '}
              <a
                href="#"
                className="text-orange-800"
                onClick={(e) => {
                  e.preventDefault()
                  setConnectModalOpen(true)
                }}
              >
                connect your wallet
              </a>{' '}
              now.
            </p>
          )}

          <p>
            Here’s what will probably happen on the Nectar system with your transaction: your transaction should be{' '}
            <InlineStatus status={eventReceivedRPCReceived}>received by the RPC node</InlineStatus>,{' '}
            <InlineStatus status={eventReceivedSentAuction}>sent to the auction</InlineStatus>,{' '}
            <InlineStatus status={eventReceivedSentSearcher}>then to the searcher</InlineStatus>. Searcher should{' '}
            <InlineStatus status={eventReceivedBundleBuilt}>build an arbitrage bundle</InlineStatus> and{' '}
            <InlineStatus status={eventReceivedBidSent}>bid on the auction</InlineStatus>,{' '}
            <InlineStatus status={eventReceivedAuctionConcluded}>eventually winning</InlineStatus>.{' '}
            <InlineStatus status={eventReceivedRPCBundleReceived}>
              The winning bundle should be delivered back to the RPC node
            </InlineStatus>
            , where{' '}
            <InlineStatus status={eventReceivedRPCBundlePublished}>it should be published via Flashbots</InlineStatus>.
          </p>
          <p className="">
            It might take many blocks to be included, mev-boost is a lot less used on Goerli vs mainnet.
          </p>
          {userTx !== '' && userTxIncluded && (
            <a
              href={`https://goerli.etherscan.io/tx/${userTx}`}
              className="block py-2 px-4 bg-blue-50 rounded-lg text-blue-700 no-underline"
            >
              View your transaction on Etherscan →
            </a>
          )}
          <p>
            Auction will regularly check for bundle inclusion. Eventually{' '}
            <InlineStatus status={eventReceivedBundleFound}>it should find the transaction</InlineStatus> and{' '}
            <InlineStatus status={eventReceivedDepositIncluded}>include rewards in the next deposit batch</InlineStatus>
            .
          </p>

          {depositTx !== '' && (
            <a
              href={`https://goerli.etherscan.io/tx/${depositTx}`}
              className="block py-2 px-4 bg-blue-50 rounded-lg text-blue-700 no-underline"
            >
              View deposit transaction on Etherscan →
            </a>
          )}

          <div className="not-prose mt-4 bg-stone-100 rounded-lg shadow-inner p-4">
            <div className="flex align-top justify-between mb-3">
              <p className="m-0 uppercase text-sm tracking-wide text-stone-400 col-span-2">
                Events (from latest to oldest)
              </p>
              <p className="m-0 uppercase text-sm tracking-wide text-stone-400 col-span-2">
                Event Server Connection:{' '}
                <span className={`font-bold ${connectionStatus === 'Open' ? 'text-green-700' : ''}`}>
                  {connectionStatus === 'Open' ? 'Connected' : connectionStatus}
                </span>
              </p>
            </div>

            <ul className="overflow-scroll h-72 list-none">
              {[...messageHistory].reverse().map((message, idx) => (
                <li className="pb-2 mb-2 border-b-[1px] border-stone-300 text-sm font-mono" key={idx}>
                  <strong
                    className={`font-bold ${message.source === 'Event Relay' ? 'text-slate-700' : ''}${
                      message.source === 'RPC' ? 'text-orange-500' : ''
                    }${message.source === 'Auction' ? 'text-purple-500' : ''}${
                      message.source === 'Searcher' ? 'text-cyan-500' : ''
                    }${message.source === 'Publisher' ? 'text-lime-500' : ''}`}
                  >
                    {message.source}:
                  </strong>{' '}
                  {message.message}
                </li>
              ))}
            </ul>
          </div>

          <h2 className="mt-8 flex align-middle font-medium text-2xl">
            <span className="block rounded-full shadow-lg bg-orange-600 text-orange-100 h-8 w-8 text-center mr-4">
              4
            </span>
            {(userFunds !== undefined && userFunds.gt(0)) || withdrawalDone
              ? 'Withdraw your rewards from the Nectar Vault!'
              : 'Waiting for deposit…'}
          </h2>

          {userFunds !== undefined && userFunds.eq(0) && !withdrawalDone && (
            <>
              <p>
                The last event in your transaction journey is getting rewards deposited for you on the Nectar contract.
                It looks like the deposit hasn’t been made yet, this demo will keep checking.
              </p>
              <p className="text-sm text-stone-500">
                Deposits on mainnet would likely happen every hour or so, but for demo purposes they are done every
                minute.
              </p>
            </>
          )}

          {((userFunds !== undefined && userFunds.gt(0)) || withdrawalDone) && (
            <>
              <p>
                The last event in your transaction journey is getting rewards deposited for you on the Nectar contract.
                That has happened, and you can withdraw your rewards.
              </p>
              <p className="text-sm text-stone-500">
                Deposits on mainnet would likely happen every hour or so, but for demo purposes they are done every
                minute.
              </p>

              {isConnected && (
                <div className="mt-4">
                  <button
                    disabled={!withdrawAllEnabled}
                    className={`${
                      withdrawAllEnabled ? 'bg-orange-500 text-white' : 'bg-stone-200 text-stone-400'
                    } rounded-md px-2 py-1 font-semibold`}
                    onClick={() => withdrawAllWrite?.()}
                  >
                    Withdraw {userFundsFetched && userFunds !== undefined ? ethers.utils.formatEther(userFunds) : '0'}{' '}
                    ETH
                  </button>
                  {/* {withdrawAllError && <div>An error occurred preparing the transaction: {withdrawAllError.message}</div>} */}
                </div>
              )}

              {withdrawalDone && <p>Witdrawal done! That concludes the Nectar demo. Thank you.</p>}
            </>
          )}

          <hr className="block border-0 border-t-[1px] border-stone-300 my-8" />

          <p className="mb-8">
            Thanks for trying out the Nectar demo. For any questions,{' '}
            <a href="https://t.me/lekevicius">message @lekevicius on Telegram</a>.
          </p>
        </div>
      </div>

      {/* <button
        className={`bg-orange-500 text-white rounded-md px-2 py-1 font-semibold`}
        onClick={() => addNectarGoerliNetwork()}
      >
        Add Nectar Goerli Network
      </button> */}
    </div>
  )
}

export default App
