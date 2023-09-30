import abi from './common/arthswap/abi';
import erc20ABI from './common/arthswap/erc20ABI';

const MOMENT_FORMAT = 'HH:mm DD.MM.YY';
const WEIGHT_REF_TIME_PER_SECOND = '1000000000000'; // 10^12, or 1,000,000,000,000

const network = {
  name: 'Rocstar',
  // endpoint: 'wss://rocstar.astar.network',
  endpoint: 'ws://127.0.0.1:9948',
  chainId: 692,
  symbol: 'RSTR',
  decimals: 18,
};

export {
  network, abi, erc20ABI, MOMENT_FORMAT, WEIGHT_REF_TIME_PER_SECOND,
};
