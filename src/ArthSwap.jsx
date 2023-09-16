import React from 'react';
import {
  Row, Col, Input, Button, Form,
} from 'antd';
const ethers = require("ethers");
import { MetaMaskSDK } from '@metamask/sdk';
import './App.css';
import detectEthereumProvider from '@metamask/detect-provider';
import abi from './common/arthswap/abi';

// const MMSDK = new MetaMaskSDK(options);

// const ethereum = MMSDK.getProvider();

// ethereum.request({ method: 'eth_requestAccounts', params: [] });

// This function detects most providers injected at window.ethereum.

const ROUTER_ADDRESS = '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB';
const ARSW_ADDRESS = '0xE17D2c5c7761092f31c9Eca49db426D5f2699BF0';
const WRSTR_ADDRESS = '0x7d5d845Fd0f763cefC24A1cb1675669C3Da62615';

const options = {
  injectProvider: false,
  communicationLayerPreference: 'webrtc',
};

// This returns the provider, or null if it wasn't detected.
const provider = await detectEthereumProvider();

if (provider) {
  // From now on, this should always be true:
  // provider === window.ethereum
  // startApp(provider); // initialize your app
  console.log('provider', provider);
} else {
  console.log('Please install MetaMask!');
}

const chainId = await window.ethereum.request({ method: 'eth_chainId' });
console.log('chainId', chainId);

function handleChainChanged(newChainId) {
  console.log('newChainId', newChainId);
  // We recommend reloading the page, unless you must do otherwise.
  window.location.reload();
}

window.ethereum.on('chainChanged', handleChainChanged);

// While awaiting the call to eth_requestAccounts, you should disable
// any buttons the user can select to initiate the request.
// MetaMask rejects any additional requests while the first is still
// pending.
async function getAccount() {
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    .catch((err) => {
      if (err.code === 4001) {
        // EIP-1193 userRejectedRequest error
        // If this happens, the user rejected the connection request.
        console.log('Please connect to MetaMask.');
      } else {
        console.error(err);
      }
    });
  console.log('accounts', accounts);
  // const account = accounts[0];
  // showAccount.innerHTML = account;
}

function ArthSwapApp() {
  // If the provider returned by detectEthereumProvider isn't the same as
  // window.ethereum, something is overwriting it – perhaps another wallet.
  if (provider !== window.ethereum) {
    console.error('Do you have multiple wallets installed?');
  }

  const [swapForm] = Form.useForm();

  const onSwapClick = async () => {
    console.log('onSwapClick!!!');
    const DEADLINE = '111111111111111111';
    // const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner();
    console.log('signer.address: ', signer.address);

    // const balance = await signer.getBalance();
    // const balance = await provider.getBalance("ethers.eth")
    const balance = await provider.getBalance(signer.address);
    console.log('signer\'s balance: ', ethers.utils.formatEther(balance));

    const contract = new ethers.Contract(ROUTER_ADDRESS, abi, signer);
    const result = await contract.swapExactETHForTokens(
      0,
      [WRSTR_ADDRESS, ARSW_ADDRESS],
      signer.address,
      DEADLINE,
      { value: ethers.utils.parseEther('0.1') },
    );

    console.log('Contract address:', ROUTER_ADDRESS);
    console.log('input:', result.data);
    console.log('signer\'s balance(BeforeSwap): ', ethers.utils.formatEther(balance));
    setTimeout(async () => {
      const balanceAfterSwap = await provider.getBalance(signer.address);
      console.log('signer\'s balance(AfterSwap): ', ethers.utils.formatEther(balanceAfterSwap));
    }, 30000);
  };

  const onFinish = (values) => {
    console.log('values: ', values);
  };

  const onValuesChange = () => {};

  const volatilityElement = null;

  return (
    <div className="page-wrapper">
      <div className="main-container">
        <div className="container page-container">
          <Row>
            <Col span={24}>
              <Button onClick={getAccount}>Get Account</Button>
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
                    <Button className="connect-wallet-button" onClick={onSwapClick}>Swap</Button>
                  </div>
                </Form>
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}

export default ArthSwapApp;
