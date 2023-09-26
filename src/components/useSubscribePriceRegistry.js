import _ from 'lodash';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { message } from 'antd';
import { useWalletPolkadot } from '../context/WalletPolkadot';

const useSubscribePriceRegistry = (updateAssetPriceFunc) => {
  const { apis } = useWalletPolkadot();
  const updateAssetPriceFuncRef = useRef(() => {});

  useLayoutEffect(() => {
    // To avoid closures referencing the same state, assign a value to updateAssetPriceFuncRef.current when updating layout.
    updateAssetPriceFuncRef.current = updateAssetPriceFunc;
  });

  useEffect(() => {
    if (_.isUndefined(apis[0])) {
      return;
    }
    const symbols = ['WRSTR', 'USDT'];
    const subscribePriceRegistry = async () => {
      await apis[0].query.automationPrice.priceRegistry('shibuya', 'arthswap', symbols, (result) => {
        if (result.isNone) {
          message.error('PriceRegistry is none; Please initialize the asset first.');
          return;
        }
        const { amount } = result.unwrap();
        updateAssetPriceFuncRef.current(amount);
      });
    };
    subscribePriceRegistry();
  }, [apis]);
};

export default useSubscribePriceRegistry;
