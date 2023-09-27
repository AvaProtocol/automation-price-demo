import { ApiPromise, WsProvider } from '@polkadot/api';

// const OAK_WS_ENDPOINT = 'wss://rpc.turing-staging.oak.tech';
const OAK_WS_ENDPOINT = 'ws://127.0.0.1:9946';

class PolkadotHelper {
  constructor() {
    this.api = null;
  }

  getPolkadotApi = async () => {
    if (!this.api) {
      const wsProvider = new WsProvider(OAK_WS_ENDPOINT);
      const polkadotApi = await ApiPromise.create({
        provider: wsProvider,
        rpc: {
          automationTime: {
            generateTaskId: {
              description: 'Getting task ID given account ID and provided ID',
              params: [
                {
                  name: 'accountId',
                  type: 'AccountId',
                },
                {
                  name: 'providedId',
                  type: 'Text',
                },
              ],
              type: 'Hash',
            },
          },
        },
      });
      this.api = polkadotApi;
    }
    return this.api;
  };
}

export default new PolkadotHelper();
