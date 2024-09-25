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
``` shell
    yarn add @uxuycom/web3-tg-sdk

```

添加图片资源

##### 3、修改WebProvider对UXUY 钱包的支持
文件
``` typescript
\\file 

```

##### 4、修改Web3Modal 对UXUY钱包的支持

##### 5、修改和添加常量

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

