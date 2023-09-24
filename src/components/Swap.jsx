import React, { useState, useCallback } from 'react';
import _ from 'lodash';
import {
  Button, Space, Modal, message,
} from 'antd';
import { WalletEthereumContextProvider, useWalletEthereum } from '../context/WalletEthereum';

import { abi, erc20ABI } from '../config';

const ROUTER_ADDRESS = '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB';
const ARSW_ADDRESS = '0xE17D2c5c7761092f31c9Eca49db426D5f2699BF0';
const WRSTR_ADDRESS = '0x7d5d845Fd0f763cefC24A1cb1675669C3Da62615';
const DEADLINE = '111111111111111111';

const ethers = require('ethers'); // eslint-disable-line import/no-extraneous-dependencies

function SwapComponent() {
  const { wallet, setWallet, provider } = useWalletEthereum();

  const [isModalLoadingSwap, setModalLoadingSwap] = useState(false);
  const [isModalOpenSwap, setModalOpenSwap] = useState(false);
  const [swapStatus, setSwapStatus] = useState('Waiting for Signature');
  const [receiptSwap, setReceiptSwap] = useState(null);

  /**
   * Modal Swap functions
   */

  const onClickSwap = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
      return;
    }

    setModalOpenSwap(true);

    // Refresh the balance and nonce before user swaps
    const balance = ethers.formatEther(await provider.getBalance(wallet?.address));
    const nonce = await provider.getTransactionCount(wallet?.address);

    setWallet(_.extend(wallet, { balance, nonce }));

    setSwapStatus('Waiting for Signature');
  }, [provider, wallet]);

  const onClickSwapSubmitted = useCallback(async () => {
    console.log('Balance before swap: ', wallet?.balance);
    setSwapStatus('Signing');

    try {
      const arthSwapContract = new ethers.Contract(ROUTER_ADDRESS, abi, wallet?.signer);
      const erc20Contract = new ethers.Contract(ARSW_ADDRESS, erc20ABI, wallet?.signer);

      setModalLoadingSwap(true);

      const result = await arthSwapContract.swapExactETHForTokens(
        0,
        [WRSTR_ADDRESS, ARSW_ADDRESS],
        wallet?.address,
        DEADLINE,
        { value: ethers.parseEther('0.01') },
      );

      setSwapStatus('Pending');

      const receipt = await provider.waitForTransaction(result.hash);

      // The below comment is used to manually examine a receipt of a transaction
      // const receipt = await provider.getTransactionReceipt(
      //   '0x635bc1f893c09f5081fc1a265bec5af15dbfe0ffe035e9c43be4e9fef9fb598d',
      // );

      console.log('receipt', receipt);
      setReceiptSwap(receipt);

      message.info(`Transaction is mined at block ${receipt.blockNumber}.`);
      setSwapStatus('Mined');

      // Parse the logs in a tx receipt to return a human readable version
      const parsedLogs = _.filter(_.map(receipt.logs, (log) => {
        let parsedItem = arthSwapContract.interface.parseLog(log);

        if (_.isNull(parsedItem)) { // Try ERC20 API if the arthSwap ABI returns null
          parsedItem = erc20Contract.interface.parseLog(log);
        }

        if (!_.isNull(parsedItem)) {
          const itemizedLogs = _.map(parsedItem.fragment.inputs, (input, index) => {
            const inputValue = parsedItem.args[index];

            return {
              name: input.name,
              type: input.type,
              value: input.type === 'uint256'
                ? ethers.formatEther(inputValue)
                : inputValue,
            };
          });

          return {
            name: parsedItem.name,
            logs: itemizedLogs,
          };
        }

        return undefined;
      }), (item) => !_.isUndefined(item));

      console.log('parsedLogs', parsedLogs);

      // Print out the ETH balance after the transaction
      const balanceAfterSwap = ethers.formatEther(await provider.getBalance(wallet?.address));
      console.log('Balance after swap: ', balanceAfterSwap);
    } catch (ex) {
      console.log(ex);

      // TODO: might need more mappings for Error handling
      if (ex.code === 'ACTION_REJECTED') {
        console.log('Signing was rejected by user.');
        message.error('Signing was rejected by user.');
        setSwapStatus('Waiting for Signature');
      }
    }

    setModalLoadingSwap(false);
  }, [wallet, provider]);

  const closeModalSwap = () => {
    setModalOpenSwap(false);
    setReceiptSwap(null);
  };

  return (
    <Space><h3>Market Buy</h3>
      <Button onClick={onClickSwap}>Swap</Button>
      <Modal
        open={isModalOpenSwap}
        title="Swap Asset"
        onOk={onClickSwapSubmitted}
        onCancel={closeModalSwap}
        maskClosable={false}
        footer={receiptSwap ? [
          <Button key="back" onClick={closeModalSwap}>
            Close
          </Button>,
        ]
          : [
            <Button key="back" onClick={closeModalSwap}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" loading={isModalLoadingSwap} onClick={onClickSwapSubmitted}>
              Submit
            </Button>,
          ]}
      />
    </Space>
  );
}

export default SwapComponent;
