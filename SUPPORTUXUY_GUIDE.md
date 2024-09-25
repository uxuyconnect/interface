### 添加UXUY Wallet的支持

#### 1、目录结构分析

分析目录架构
```
web
|-src
    |-assets                            //资源文件目录
        |- wallets
            |- uxuy-wallet-icon.svg     //添加uxuy wallet 钱包图标
    |-commponts                         //组件目录
        |- NavBar                       //导航菜单组件目录
        |- WalletModal                  //钱包组件
        |- Web3Provider                 //Web3网络支持
        
    |-constants                         //常量定义目录

    |-pages                             //应用界面
        |- App

```

#### 2、安装和添加资源
添加sdk model
``` shell
    yarn add @uxuycom/web3-tg-sdk

```

添加图片资源
```
app/web/src/assets/wallets/uxuy-wallet-icon.svg

```

##### 3、修改WebProvider对UXUY 钱包的支持
在 app/web/src/components/Web3Provider 目录添加对uxuy wallet的支持，新增一个钱包连接器

``` typescript
//add file uxuyConnector.ts
import { WalletTgSdk } from '@uxuycom/web3-tg-sdk';

import {
  type Connector,
  ProviderNotFoundError,
  ChainNotConfiguredError,
  createConnector,
} from '@wagmi/core';
import {
  type AddEthereumChainParameter,
  type Address,
  type ProviderConnectInfo,
  type ProviderRpcError,
  type RpcError,
  SwitchChainError,
  UserRejectedRequestError,
  getAddress,
  numberToHex,
} from 'viem'

export type UxuyParameters = {
  shimDisconnect?: boolean | undefined;
};

const type = 'uxuy' as const;

export function uxuy(parameters: UxuyParameters = {}) {
  const { shimDisconnect = false } = parameters;

  
  type Provider = WalletTgSdk['ethereum'] | undefined;
  type Properties = {};
  type StorageItem = { 'uxuy.disconnected': true };

  let provider_: Provider | undefined;
  let disconnect: Connector['onDisconnect'] | undefined;
  let accountsChanged: Connector['onAccountsChanged'] | undefined;
  let chainChanged: Connector['onChainChanged'] | undefined;

  return createConnector<Provider, Properties, StorageItem>((config) => ({
    id: 'uxuyWallet',
    name: 'UXUY Wallet',
    type: "uxuy",



    async connect() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();

      const chainId = await this.getChainId();

      console.log("chain id:"+chainId)
      const accounts = await this.getAccounts();

      if (!disconnect) {
        disconnect = this.onDisconnect.bind(this);
        provider.on('disconnect', disconnect);
      }

      if (!chainChanged) {
        chainChanged = this.onChainChanged.bind(this);
        provider.on('chainChanged', chainChanged);
      }

      // Switch to chain if provided
      let currentChainId = await this.getChainId();
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain!({ chainId }).catch((error) => {
          return { id: currentChainId };
        });
        currentChainId = chain?.id ?? currentChainId;
      }

      // Remove disconnected shim if it exists
      if (shimDisconnect) await config.storage?.removeItem('uxuy.disconnected');

      return { accounts, chainId };
    },
    async disconnect() {
      const provider = await this.getProvider()
      try {
        await provider?.disconnect()
      } catch (error) {
        if (!/No matching key/i.test((error as Error).message)) throw error
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
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();

      const accounts = await provider.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Validate and format the accounts
      return accounts.map((account: string) => {
        if (!account || account.trim() === "") {
          throw new Error("Received empty or invalid account");
        }
        return getAddress(account);
      });
    },
    
    async getProvider() {
      if (!provider_) {
        const { ethereum } = new WalletTgSdk({injected:true});
        provider_ = ethereum;
      }
      return provider_;
    },
    async getChainId() {
      const provider = await this.getProvider();
      if (!provider) throw new ProviderNotFoundError();
      return Number(await provider.request({ method: 'eth_chainId' }));
    },
    async isAuthorized() {      
       return false //首次不检查并打开连接
    },
    
    onAccountsChanged(accounts) {
      if (accounts.length === 0) this.onDisconnect();
      else config.emitter.emit('change', { accounts: accounts.map((x) => getAddress(x)) });
    },

    onChainChanged(chain) {
      const chainId = Number(chain);
      config.emitter.emit('change', { chainId });
    },

    onDisconnect() {
      config.emitter.emit('disconnect');
    },

    async switchChain({ chainId }) {
      const provider = await this.getProvider();
      if (!provider) {
        throw new ProviderNotFoundError();
      }

      const chain = config.chains.find((x) => x.id === chainId);
      console.log("==Switch ChainID is:"+chain)

      if (!chain) {
        throw new SwitchChainError(new ChainNotConfiguredError());
      }

      try {
        // 使用 provider.request() 切换链
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(chainId) }],
        });
        // 如果成功切换链，返回链对象
        return chain;
      } catch (error) {
        // 如果用户拒绝请求，抛出 UserRejectedRequestError
        if (/(user rejected)/i.test((error as RpcError).message)) {
          throw new UserRejectedRequestError(error);
        }

        // 如果切换失败，可以尝试添加链
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: numberToHex(chainId),
            chainName: chain.name,
            rpcUrls: chain.rpcUrls.default.http,
            nativeCurrency: chain.nativeCurrency,
            blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : [],
          }],
        });

        return chain;
      }
    },

  }));
}

```

同目录下,修改contants.ts 添加支持
``` typescript
...
import UXUYWALLET_ICON from 'assets/wallets/uxuy-wallet-icon.svg'

...
export const CONNECTION = {
  WALLET_CONNECT_CONNECTOR_ID: 'walletConnect',
  UNISWAP_WALLET_CONNECT_CONNECTOR_ID: 'uniswapWalletConnect',
  INJECTED_CONNECTOR_ID: 'injected',
  INJECTED_CONNECTOR_TYPE: 'injected',
  COINBASE_SDK_CONNECTOR_ID: 'coinbaseWalletSDK',
  COINBASE_RDNS: 'com.coinbase.wallet',
  METAMASK_RDNS: 'io.metamask',
  UXUY_WALLET:'uxuyWallet', //add UXUY_WALLET
  UNISWAP_EXTENSION_RDNS: 'org.uniswap.app',
  SAFE_CONNECTOR_ID: 'safe',
} as const

export const CONNECTOR_ICON_OVERRIDE_MAP: { [id in string]?: string } = {
  [CONNECTION.METAMASK_RDNS]: METAMASK_ICON,
  [CONNECTION.UXUY_WALLET]:UXUYWALLET_ICON, //ADD UXUY_WALLET
  [CONNECTION.UNISWAP_WALLET_CONNECT_CONNECTOR_ID]: UNIWALLET_ICON,
  [CONNECTION.COINBASE_SDK_CONNECTOR_ID]: COINBASE_ICON,
  [CONNECTION.WALLET_CONNECT_CONNECTOR_ID]: WALLET_CONNECT_ICON,
  [CONNECTION.SAFE_CONNECTOR_ID]: GNOSIS_ICON,
}

```


##### 4、修改Web3Modal 对UXUY钱包的支持
在app/web/src/components/Web3Modal/useOrderedConnections.tsx 加入对UXUY钱包的支持
``` typescript
//useOrderedConnections.tsx

添加uxuy钱包的的支持
return useMemo(() => {
    const { injectedConnectors: injectedConnectorsBase, isCoinbaseWalletBrowser } = getInjectedConnectors(
      connectors,
      excludeUniswapConnections,
    )
    const injectedConnectors = injectedConnectorsBase.map((c) => ({ ...c, isInjected: true }))
    
    const uxuyWalletConnector = getConnectorWithId(connectors, CONNECTION.UXUY_WALLET, SHOULD_THROW) // add uxuyWalletConnector

    const coinbaseSdkConnector = getConnectorWithId(connectors, CONNECTION.COINBASE_SDK_CONNECTOR_ID, SHOULD_THROW)
    const walletConnectConnector = getConnectorWithId(connectors, CONNECTION.WALLET_CONNECT_CONNECTOR_ID, SHOULD_THROW)
    const uniswapWalletConnectConnector = getConnectorWithId(
      connectors,
      CONNECTION.UNISWAP_WALLET_CONNECT_CONNECTOR_ID,
      SHOULD_THROW,
    )
    if (!coinbaseSdkConnector || !walletConnectConnector || !uniswapWalletConnectConnector) {
      throw new Error('Expected connector(s) missing from wagmi context.')
    }

    // Special-case: Only display the injected connector for in-wallet browsers.
    if (isMobileWeb && injectedConnectors.length === 1) {
      return injectedConnectors
    }

    // Special-case: Only display the Coinbase connector in the Coinbase Wallet.
    if (isCoinbaseWalletBrowser) {
      return [coinbaseSdkConnector]
    }

    const orderedConnectors: InjectableConnector[] = []
    const shouldDisplayUniswapWallet = !excludeUniswapConnections && (isWebIOS || isWebAndroid || !isTouchable)

    // Place the Uniswap Wallet at the top of the list by default.
    if (shouldDisplayUniswapWallet) {
      orderedConnectors.push(uniswapWalletConnectConnector)
    }

    // Injected connectors should appear next in the list, as the user intentionally installed/uses them.
    orderedConnectors.push(...injectedConnectors)
    //UxuyConnect added in the list
    orderedConnectors.push(uxuyWalletConnector)

    // WalletConnect and Coinbase are added last in the list.
    orderedConnectors.push(walletConnectConnector)
    orderedConnectors.push(coinbaseSdkConnector)

   

    // Place the most recent connector at the top of the list.
    orderedConnectors.sort(sortByRecent)
    return orderedConnectors
  }, [connectors, excludeUniswapConnections, sortByRecent])
}

```


##### 5、添加内容安全策略CSP
在 app/web/public/csp.json 中添加安全策略通信
```json
    "https://connector.uxrelay.com/transaction",
    "https://bridge.uxrelay.com",
    "https://eth-mainnet.public.blastapi.io",
    "https://bscrpc.com",
    "https://arbitrum.llamarpc.com",
    "https://optimism.gateway.tenderly.co",
    "https://1rpc.io/avax/c"

```

##### 6、运行与构建
运行改项目，首先需要生成graphql 相关代码
```
yarn uniswap graphql:generate
```

@uniswap/interface:ajv 需要有__generated__的打开权限，（在MacOS环境中会打开错误），因此我们需要手动创建下面这个目录
```
./apps/web/src/utils/__generated__/
```

开发调试运行：
```
yarn web start
```

构建发布
```
yarn web build:production
```

