import React, { useState, useCallback } from 'react';
import _ from 'lodash';
import BN from 'bn.js';
import moment from 'moment';
import { u8aToHex, hexToU8a } from '@polkadot/util';
import { Buffer } from 'buffer';
import {
  Button, Space, Modal, message,
} from 'antd';
import Keyring from '@polkadot/keyring';

import { useWalletPolkadot } from '../context/WalletPolkadot';
import {
  listenEvents, sendExtrinsic, getHourlyTimestamp, getDerivativeAccountV2, getDerivativeAccountV3,
} from '../common/utils';

import { WEIGHT_REF_TIME_PER_SECOND } from '../config';

function AutomationTimeComponent() {
  const {
    wallet, apis,
  } = useWalletPolkadot();

  const [isModalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  /**
   * Use MetaMask to schedule a Swap transaction via XCM
   */
  const onClickScheduleByPrice = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
    }

    try {
      const turingApi = apis[0];
      const parachainApi = apis[1];

      console.log('turingApi: ', turingApi);
      console.log('parachainApi: ', parachainApi);

      const result = await turingApi.query.automationPrice.priceRegistry.entries('shibuya', 'arthswap');
      console.log('price: ', result[0][1].unwrap().amount.toString());
    } catch (error) {
      console.log(error);
    }
  }, [wallet, apis]);

  return (
    <Space><h3>Swap by Price</h3>
      <Button onClick={onClickScheduleByPrice}>Create a limit order</Button>
    </Space>
  );
}

export default AutomationTimeComponent;
