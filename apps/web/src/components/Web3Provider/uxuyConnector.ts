import { WalletTgSdk } from '@uxuycom/web3-tg-sdk'

import { ChainNotConfiguredError, ProviderNotFoundError, createConnector, type Connector } from '@wagmi/core'
import { SwitchChainError, UserRejectedRequestError, getAddress, numberToHex, type RpcError } from 'viem'

// export type UxuyParameters = {
//   shimDisconnect?: boolean | undefined
// }

export function uxuy() {
  // const { shimDisconnect = false } = parameters

  type Provider = WalletTgSdk['ethereum'] | undefined
  // type StorageItem = { 'uxuy.disconnected': true }

  let provider_: Provider | undefined
  let disconnect: Connector['onDisconnect'] | undefined
  let accountsChanged: Connector['onAccountsChanged'] | undefined
  let chainChanged: Connector['onChainChanged'] | undefined

  return createConnector<Provider>((config) => ({
    id: 'uxuyWallet',
    name: 'UXUY Wallet',
    type: 'uxuy',

    async connect() {
      const provider = await this.getProvider()
      if (!provider) {
        throw new ProviderNotFoundError()
      }
      const chainId = await this.getChainId()

      const accounts = await this.getAccounts()

      if (!disconnect) {
        disconnect = this.onDisconnect.bind(this)
        provider.on('disconnect', disconnect)
      }

      if (!chainChanged) {
        chainChanged = this.onChainChanged.bind(this)
        provider.on('chainChanged', chainChanged)
      }

      // Switch to chain if provided
      let currentChainId = await this.getChainId()
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain!({ chainId }).catch((error) => {
          throw error
          //return { id: currentChainId }
        })
        currentChainId = chain?.id ?? currentChainId
      }
      return { accounts, chainId }
    },
    async disconnect() {
      const provider = await this.getProvider()
      try {
        await provider?.disconnect()
      } catch (error) {
        if (!/No matching key/i.test((error as Error).message)) {
          throw error
        }
      } finally {
        if (chainChanged) {
          provider?.removeListener('chainChanged', chainChanged)
          chainChanged = undefined
        }
        if (disconnect) {
          provider?.removeListener('disconnect', disconnect)
          disconnect = undefined
        }

        if (accountsChanged) {
          provider?.removeListener('accountsChanged', accountsChanged)
          accountsChanged = undefined
        }
      }
    },

    async getAccounts() {
      const provider = await this.getProvider()
      if (!provider) {
        throw new ProviderNotFoundError()
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found')
      }

      // Validate and format the accounts
      return accounts.map((account: string) => {
        if (!account || account.trim() === '') {
          throw new Error('Received empty or invalid account')
        }
        return getAddress(account)
      })
    },

    async getProvider() {
      if (!provider_) {
        const { ethereum } = new WalletTgSdk({ injected: true })
        provider_ = ethereum
      }
      return provider_
    },

    async getChainId() {
      const provider = await this.getProvider()
      if (!provider) {
        throw new ProviderNotFoundError()
      }
      return Number(await provider.request({ method: 'eth_chainId' }))
    },

    async isAuthorized() {
      return false //首次不校验
    },

    onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        this.onDisconnect()
      } else {
        config.emitter.emit('change', { accounts: accounts.map((x) => getAddress(x)) })
      }
    },
    onChainChanged(chain) {
      const chainId = Number(chain)
      config.emitter.emit('change', { chainId })
    },
    onDisconnect() {
      config.emitter.emit('disconnect')
    },

    async switchChain({ chainId }) {
      const provider = await this.getProvider()
      if (!provider) {
        throw new ProviderNotFoundError()
      }

      const chain = config.chains.find((x) => x.id === chainId)

      if (!chain) {
        throw new SwitchChainError(new ChainNotConfiguredError())
      }

      try {
        // 使用 provider.request() 切换链
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(chainId) }],
        })

        // 如果成功切换链，返回链对象
        return chain
      } catch (error) {
        // 如果用户拒绝请求，抛出 UserRejectedRequestError
        if (/(user rejected)/i.test((error as RpcError).message)) {
          throw new UserRejectedRequestError(error)
        }

        // 如果切换失败，可以尝试添加链
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: numberToHex(chainId),
              chainName: chain.name,
              rpcUrls: chain.rpcUrls.default.http,
              nativeCurrency: chain.nativeCurrency,
              blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : [],
            },
          ],
        })

        return chain
      }
    },
  }))
}
