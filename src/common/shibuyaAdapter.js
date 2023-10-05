import _ from 'lodash';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { chains, assets } from '@oak-network/config';

const { shibuya } = chains;

class ShibuyaAdapter {
  constructor(config) {
    this.config = config;
    this.api = undefined;
    this.isInitializing = false;
  }

  initialize = async () => {
    // Make sure we don't call ApiPromise.create() multiple times. This is important because React components can be re-rendered multiple times
    // in a very short period of time, during which ApiPromise.create() can be called multiple times.
    if (this.isInitializing) {
      return undefined;
    }

    if (_.isUndefined(this.api)) {
      this.isInitializing = true;
      this.api = await ApiPromise.create({ provider: new WsProvider(this.config.endpoint) });
      this.isInitializing = false;
      // console.log('ShibuyaAdapter.initialize has completed ApiPromise.create.', this.api);
    }

    return this.api;
  };

  disconnect = async () => {
    this.api.disconnect();
  };
}

const shibuyaAdapter = new ShibuyaAdapter(shibuya);

export default shibuyaAdapter;
