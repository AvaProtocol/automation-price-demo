# React Demo App for AutomationPrice
This program serves as a demonstration of placing limit orders on ArthSwap while utilizing the integration of Shibuya and Turing Dev networks. It will also be compatible with the Rococo test environment, specifically Rocstar and Turing Staging. The ArthSwap team has deployed a smart contract on Rocstar for testing purposes.

## Get Started
The app is built using Create React App and @oak-network/sdk.
### Environment Setup
The app is configured to run with the following environments and releases:
Turing Dev: https://github.com/OAK-Foundation/OAK-blockchain/releases/tag/v2.0.1
Shibuya: https://github.com/AstarNetwork/Astar/releases/tag/v5.20.0

Please refer to the instructions of https://github.com/OAK-Foundation/OAK-blockchain#quickstart---run-local-networks-with-zombienet on how to run the local networks. Once you installed zombienet, you can spin up the two networks with `zombienet spawn zombienets/turing/shibuya.toml`.

### Run the app
Install dependencies, `yarn`
Start the app, `yarn start`

> This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). For more available scripts, check out their README.md.

## Learn More

You can learn more about OAK’s automation in the [Price Automation Explained](https://docs.oak.tech/docs/price-automation-explained/).(to be updated), or contribute to its open-source code in [OAK-blockchain repo](https://github.com/OAK-Foundation/OAK-blockchain) or [oak.js SDK packages repo](https://github.com/OAK-Foundation/oak.js).

