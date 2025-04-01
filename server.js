const express = require('express');
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const provider = new HDWalletProvider({
  privateKeys: [process.env.PRIVATE_KEY],
  providerOrUrl: process.env.RPC_URL
});
const web3 = new Web3(provider);

const defaultAccount = provider.getAddress(0);
console.log("Using account:", defaultAccount);

// Load ABIs
const nftArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/contracts/FractionalNFT.json')));
const tokenArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/contracts/FractionalToken.json')));

// Set up NFT contract instance
const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
const nftContract = new web3.eth.Contract(nftArtifact.abi, nftAddress);

// 🔐 API Key Middleware
app.use((req, res, next) => {
  if (req.path === '/') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Unauthorized: Invalid or missing API key' });
  }
  next();
});

// 🔨 CREATE fractionalized NFT
app.post('/create', async (req, res) => {
  const {
    uri,
    totalFractions,
    loan_number,
    risk_tier,
    principal,
    interest,
    term,
    school
  } = req.body;

  try {
    const tx = await nftContract.methods.mintAndFractionalize(
      defaultAccount,
      uri,
      totalFractions,
      loan_number,
      risk_tier,
      principal,
      interest,
      term,
      school
    ).send({ from: defaultAccount, gas: 3000000 });

    const tokenAddress = await nftContract.methods.fractionalToken().call();

    res.json({
      success: true,
      txHash: tx.transactionHash,
      fractionalToken: tokenAddress
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 🔁 TRANSFER tokens
app.post('/transfer', async (req, res) => {
  const { tokenAddress, to, amount } = req.body;

  try {
    const token = new web3.eth.Contract(tokenArtifact.abi, tokenAddress);

    const balanceBeforeFrom = await token.methods.balanceOf(defaultAccount).call();
    const balanceBeforeTo = await token.methods.balanceOf(to).call();

    const tx = await token.methods.transfer(to, amount).send({ from: defaultAccount, gas: 100000 });

    const balanceAfterFrom = await token.methods.balanceOf(defaultAccount).call();
    const balanceAfterTo = await token.methods.balanceOf(to).call();

    res.json({
      success: true,
      txHash: tx.transactionHash,
      from: defaultAccount,
      to,
      amount,
      balances: {
        before: {
          [defaultAccount]: balanceBeforeFrom,
          [to]: balanceBeforeTo
        },
        after: {
          [defaultAccount]: balanceAfterFrom,
          [to]: balanceAfterTo
        }
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 🔍 GET /balance/:tokenAddress/:investorAddress
app.get('/balance/:tokenAddress/:investorAddress', async (req, res) => {
  const { tokenAddress, investorAddress } = req.params;

  try {
    const token = new web3.eth.Contract(tokenArtifact.abi, tokenAddress);

    const vaultAddress = defaultAccount;

    const investorBal = await token.methods.balanceOf(investorAddress).call();
    const vaultBal = await token.methods.balanceOf(vaultAddress).call();
    const totalSupply = await token.methods.totalSupply().call();

    res.json({
      token: tokenAddress,
      vault: vaultAddress,
      investor: investorAddress,
      balances: {
        vault: vaultBal,
        investor: investorBal,
        totalSupply: totalSupply
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /metadata/:tokenId
app.get('/metadata/:tokenId', async (req, res) => {
  const { tokenId } = req.params;

  try {
    const data = await nftContract.methods.getMetadata(tokenId).call();

    res.json({
      tokenId,
      loan_number: data.loan_number,
      risk_tier: parseInt(data.risk_tier),  // enum index (0 = Low, 1 = Medium, 2 = High)
      principal: data.principal,
      interest: data.interest,
      term: data.term,
      school: data.school
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ HEALTH: Test endpoint
app.get('/', (req, res) => {
  res.send('Fractional NFT API is live 🎯');
});

// GET /tokenid
app.get('/tokenid', async (req, res) => {
  try {
    const id = await nftContract.methods.tokenId().call();
    const lastMintedId = id > 0 ? id - 1 : null;

    res.json({
      nextTokenId: id,
      lastMintedTokenId: lastMintedId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Launch server
app.listen(3000, () => {
  console.log('🚀 API live at http://localhost:3000');
});
