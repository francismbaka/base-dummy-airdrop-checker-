const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/api/check-wallet', async (req, res) => {
  const { address } = req.query;
  
  // 1. Basic Validation
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid wallet address format" });
  }

  const API_KEY = process.env.BASESCAN_API_KEY || 'JHPSPADURZKEPAUJMAPSS2P2VV38ITP9Z2';
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  try {
    // 2. Concurrent fetches for ETH and USDC - FIXED SYNTAX
    const [ethRes, usdcRes] = await Promise.all([
      fetch(`https://api.basescan.org/api?module=account&action=txlist&address=${address}&apikey=${API_KEY}`),
      fetch(`https://api.basescan.org/api?module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${address}&apikey=${API_KEY}`)
    ]);

    const ethData = await ethRes.json();
    const usdcData = await usdcRes.json();

    if (ethData.status !== "1") {
      return res.status(400).json({ error: ethData.message || "Basescan Error" });
    }

    // 3. Calculation Logic
    const txs = ethData.result;
    const txCount = txs.length;
    const ethVolume = txs.reduce((acc, tx) => acc + (Number(tx.value) / 1e18), 0);
    const usdcVolume = usdcData.result ? usdcData.result.reduce((acc, tx) => acc + (Number(tx.value) / 1e6), 0) : 0;
    const contracts = txs.filter(tx => tx.to === "" || tx.contractAddress !== "").length;

    // Weighting: ETH at 1x, USDC at equivalent weight, Contracts at 100x
    const points = (txCount * 1) + (ethVolume * 10) + (usdcVolume * 0.004) + (contracts * 100);
    const allocation = Math.floor((points / 500) * 25000000000);

    res.json({
      summary: `You have ${txCount} transactions, ${ethVolume.toFixed(2)} ETH, ${usdcVolume.toFixed(2)} USDC volume and deployed ${contracts} contracts on Base.`,
      allocation: allocation.toLocaleString(),
      stats: { txCount, ethVolume, usdcVolume, contracts }
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Server error fetching on-chain data" });
  }
});

module.exports = app;
