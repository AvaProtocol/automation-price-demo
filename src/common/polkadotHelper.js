import { ApiPromise, WsProvider } from '@polkadot/api';

const OAK_WS_ENDPOINT = 'wss://rpc.turing-staging.oak.tech';

class PolkadotHelper {
	getPolkadotApi = async () => {
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
    return polkadotApi;
  }
}

export default new PolkadotHelper();
