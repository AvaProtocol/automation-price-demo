import React, { useState, useEffect, useCallback } from 'react';
import _ from 'lodash';
import {
  Row, Col, Input, Button, Form, Modal, Radio, Space, message,
} from 'antd';
import './App.css';
import abi from './common/arthswap/abi';
import erc20ABI from './common/arthswap/erc20ABI';

const ethers = require('ethers'); // eslint-disable-line import/no-extraneous-dependencies

const ROUTER_ADDRESS = '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB';
const ARSW_ADDRESS = '0xE17D2c5c7761092f31c9Eca49db426D5f2699BF0';
const WRSTR_ADDRESS = '0x7d5d845Fd0f763cefC24A1cb1675669C3Da62615';
const DEADLINE = '111111111111111111';

const network = {
  name: 'Rocstar',
  endpoint: 'https://rocstar.astar.network',
  chainId: 692,
  symbol: 'RSTR',
};

function handleChainChanged(newChainId) {
  console.log('newChainId', newChainId);
  // We recommend reloading the page, unless you must do otherwise.
  window.location.reload();
}

window.ethereum.on('chainChanged', handleChainChanged);

function ArthSwapApp() {
  const [swapForm] = Form.useForm();

  // Modal Wallet Connect states
  const [isModalLoadingWalletConnect, setModalLoadingWalletConnect] = useState(false);
  const [isModalOpenWalletConnect, setModalOpenWalletConnect] = useState(false);
  const [radioValue, setRadioValue] = useState(1);

  // Modal Swap states
  const [isModalLoadingSwap, setModalLoadingSwap] = useState(false);
  const [isModalOpenSwap, setModalOpenSwap] = useState(false);
  const [swapStatus, setSwapStatus] = useState('Waiting for Signature');
  const [receiptSwap, setReceiptSwap] = useState(null);

  // Modal Schedule states
  const [isModalLoadingSchedule, setModalLoadingSchedule] = useState(false);
  const [isModalOpenSchedule, setModalOpenSchedule] = useState(false);
  const [sendingSchedule, setSendingSchedule] = useState(false);

  // App states
  const [provider, setProvider] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [wallet, setWallet] = useState(null); /* New */

  useEffect(() => {
    // This code will run after the component has rendered
    // Place your code here for actions to be performed after rendering
    console.log('Page components have rendered');

    async function asyncInit() {
      try {
        let providerOnLoad = null;
        if (_.isNull(window.ethereum)) {
          // If MetaMask is not installed, we use the default provider,
          // which is backed by a variety of third-party services (such as INFURA).
          // They do not have private keys installed so are only have read-only access
          console.log('MetaMask is not installed; using read-only default providers');
          providerOnLoad = ethers.getDefaultProvider();
        } else {
          // Connect to the MetaMask EIP-1193 object. This is a standard protocol
          // that allows Ethers access to make all read-only requests through MetaMask.
          providerOnLoad = new ethers.BrowserProvider(window.ethereum);
          console.log('MetaMask is installed and loaded.');
        }

        setProvider(providerOnLoad);

        const chainId = await providerOnLoad.send('eth_chainId', []);
        const chainIdDecimal = parseInt(chainId, 16);
        console.log(`network chainId: ${chainIdDecimal} (${chainIdDecimal === network.chainId ? 'Rocstar' : 'Unknown'})`);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect

    // You can perform any cleanup or additional actions here if needed
    // For example, removing event listeners or making API requests
    // Be sure to return a cleanup function if necessary
    return () => {
      // Cleanup code here (if needed)
    };
  }, []); // The empty dependency array [] ensures that this effect runs only once, similar to componentDidMount

  const onFinish = (values) => {
    console.log('values: ', values);
  };

  const onValuesChange = () => {};

  const volatilityElement = null;

  /**
   * Modal Wallet Connect functions
   */
  const onClickConnectWallet = useCallback(async () => {
    console.log('onClickConnectWallet is called, provider: ', provider);

    // Request permission to connect users accounts from Metamask
    const requestedAccounts = await provider.send('eth_requestAccounts', []);

    console.log('requestedAccounts', requestedAccounts);
    setAccounts(requestedAccounts);
    setModalOpenWalletConnect(true);
  }, [provider]);

  const onClickWalletSelectSubmitted = useCallback(async () => {
    console.log('Setting radioValue as selected account', radioValue);

    setModalLoadingWalletConnect(true);

    console.log('Found selected radio from provider', radioValue);

    const signer = await provider.getSigner(radioValue);
    console.log('signer: ', signer);

    const signerAddress = await signer.getAddress();

    console.log('signer.address: ', signerAddress);

    const balance = await provider.getBalance(signer.address);
    const formattedBalance = ethers.formatEther(balance);

    const nonce = await provider.getTransactionCount(signer.address);

    setModalLoadingWalletConnect(false);
    setModalOpenWalletConnect(false);

    setWallet({
      signer, address: signerAddress, balance: formattedBalance, nonce,
    });
  }, [radioValue, provider]);

  const closeModalWalletConnect = () => {
    setModalOpenWalletConnect(false);
  };

  const onRadioChange = (e) => {
    console.log('Selected Radio value', e.target.value);
    setRadioValue(e.target.value);
  };

  /**
   * Modal Swap functions
   */

  const onClickSwap = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
      return;
    }

    setModalOpenSwap(true);

    const balance = ethers.formatEther(await provider.getBalance(wallet.address));
    const nonce = await provider.getTransactionCount(wallet.address);

    setWallet(_.extend(wallet, { balance, nonce }));

    setSwapStatus('Waiting for Signature');
  }, [provider, wallet]);

  const onClickSwapSubmitted = useCallback(async () => {
    console.log('Balance before swap: ', wallet.balance);
    setSwapStatus('Signing');

    try {
      const arthSwapContract = new ethers.Contract(ROUTER_ADDRESS, abi, wallet.signer);
      const erc20Contract = new ethers.Contract(ARSW_ADDRESS, erc20ABI, wallet.signer);

      setModalLoadingSwap(true);

      const result = await arthSwapContract.swapExactETHForTokens(
        0,
        [WRSTR_ADDRESS, ARSW_ADDRESS],
        wallet.address,
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
      const balanceAfterSwap = ethers.formatEther(await provider.getBalance(wallet.address));
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

  const onClickDisconnectWallet = useCallback(async () => {
    console.log('onClickDisconnectWallet call back is called.');

    setAccounts([]);
    setWallet(null);
  }, []);

  /**
   * Main functions
   */
  return (
    <div className="page-wrapper">
      <Space>
        <div className="main-container">
          <div className="container page-container">
            <Row>
              <Col span={24}>
                { _.isNil(wallet)
                  ? (<Button onClick={onClickConnectWallet}>Connect Metamask</Button>)
                  : (
                    <div><div>Wallet:</div><div>{wallet.address}</div>
                      <div>Balance:</div><div>{wallet.balance} {network.symbol}</div>
                      <div>Nonce:</div><div>{wallet.nonce}</div>
                      <Button onClick={onClickConnectWallet}>Switch Wallet</Button>
                      <Button onClick={onClickDisconnectWallet}>Disconnect Metamask</Button>
                    </div>
                  )}
                <Modal
                  open={isModalOpenWalletConnect}
                  title="Connect Wallet"
                  onOk={onClickWalletSelectSubmitted}
                  onCancel={closeModalWalletConnect}
                  maskClosable={false}
                  footer={[
                    <Button key="back" onClick={closeModalWalletConnect}>
                      Cancel
                    </Button>,
                    <Button key="submit" type="primary" loading={isModalLoadingWalletConnect} onClick={onClickWalletSelectSubmitted}>
                      Confirm
                    </Button>,
                  ]}
                >
                  <Radio.Group onChange={onRadioChange} value={radioValue}>
                    <Space direction="vertical">
                      {_.map(accounts, (item) => (<Radio value={item} key={item}>{item}</Radio>))}
                    </Space>
                  </Radio.Group>
                </Modal>
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <div className="price-feed-container">
                  <h1>ArthSwap Price Feed:</h1>
                  <div>
                    <table>
                      <thead>
                        <tr className="price-row" style={{ color: '#95098B' }}>
                          <th className="price-col price-first-col">timestamp</th>
                          <th className="price-col">asset</th>
                          <th className="price-col">value</th>
                        </tr>
                      </thead>
                      <tbody />
                    </table>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="swap-container">
                  <h1>Swap Options</h1>
                  <div style={{ paddingTop: 12, paddingBottom: 24 }} />
                  <Form
                    form={swapForm}
                    name="basic"
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    autoComplete="off"
                    onValuesChange={onValuesChange}
                    labelAlign="left"
                  >
                    <Row>
                      <Col span={24}>
                        <Form.Item label="Stop">
                          <Row>
                            <Col span={10}>
                              <Form.Item name="price" rules={[{ required: true, message: 'Please input price!' }]} noStyle>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={14}>
                              <span style={{ paddingLeft: 12, lineHeight: '32px' }} />
                              { volatilityElement }
                            </Col>
                          </Row>
                        </Form.Item>
                        <Form.Item label="Amount">
                          <Row>
                            <Col span={10}>
                              <Form.Item name="mgxAmount" rules={[{ required: true, message: 'Please enter a MGX amount' }]}>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={14}><span style={{ paddingLeft: 12, lineHeight: '32px' }} /></Col>
                          </Row>
                        </Form.Item>
                        <Form.Item label="Expected Output:">
                          <Row>
                            <Col span={16} />
                          </Row>
                        </Form.Item>

                      </Col>
                    </Row>

                    <div className="important">
                      <p className="title">Important:</p>
                      <p>Turing will trigger the transaction for inclusion after the price threshold has been met;</p>
                      we cannot guarantee the price received.
                    </div>

                    <div className="d-flex justify-content-center">
                      <Button className="connect-wallet-button" onClick={onClickSwap}>Swap</Button>
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
                      >
                        <dl>
                          <div>
                            <dt>Wallet</dt>
                            <dd>{wallet?.address}</dd>
                          </div>
                          <div>
                            <dt>Balance</dt>
                            <dd>{wallet?.balance} {network.symbol}</dd>
                          </div>
                          <div>
                            <dt>Smart Contract</dt>
                            <dd>{ROUTER_ADDRESS} (ArthSwap Router)</dd>
                          </div>
                          <div>
                            <dt>Method</dt>
                            <dd>swapExactETHForTokens (Market Buy)</dd>
                          </div>
                          <div>
                            <dt>Amount</dt>
                            <dd>0.01 ${network.symbol}</dd>
                          </div>
                          <div>
                            <dt>Estimated Amount</dt>
                            <dd>100 ARTH</dd>
                          </div>
                          <br />
                          <div>
                            <dt>Status</dt>
                            <dd>{swapStatus}</dd>
                          </div>
                          {receiptSwap?.blockNumber && (
                          <div>
                            <dt>Mined Block Height</dt>
                            <dd>{receiptSwap?.blockNumber}</dd>
                          </div>
                          )}
                          {receiptSwap?.hash && (
                          <div>
                            <dt>Transaction Hash</dt>
                            <dd>{receiptSwap?.hash}</dd>
                          </div>
                          )}
                        </dl>
                      </Modal>
                    </div>
                  </Form>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Space>
    </div>
  );
}

export default ArthSwapApp;
