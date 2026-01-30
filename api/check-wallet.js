export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { address } = req.query;
  
  // Debug logging
  console.log('Received address:', address);
  console.log('Full query:', req.query);
  
  // 1. Basic Validation
  if (!address) {
    return res.status(400).json({ 
      error: "No wallet address provided",
      hint: "Add ?address=0x... to your URL" 
    });
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ 
      error: "Invalid wallet address format",
      received: address,
      hint: "Address must be 42 characters starting with 0x"
    });
  }

  const API_KEY = process.env.BASESCAN_API_KEY || 'JHPSPADURZKEPAUJMAPSS2P2VV38ITP9Z2';
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  try {
    const [ethRes, usdcRes] = await Promise.all([
      fetch(`https://api.basescan.org/api?module=account&action=txlist&address=${address}&apikey=${API_KEY}`),
      fetch(`https://api.basescan.org/api?module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${address}&apikey=${API_KEY}`)
    ]);

    const ethData = await ethRes.json();
    const usdcData = await usdcRes.json();

    if (ethData.status !== "1") {
      return res.status(400).json({ error: ethData.message || "Basescan Error" });
    }

    const txs = ethData.result;
    const txCount = txs.length;
    const ethVolume = txs.reduce((acc, tx) => acc + (Number(tx.value) / 1e18), 0);
    const usdcVolume = usdcData.result ? usdcData.result.reduce((acc, tx) => acc + (Number(tx.value) / 1e6), 0) : 0;
    const contracts = txs.filter(tx => tx.to === "" || tx.contractAddress !== "").length;

    const points = (txCount * 1) + (ethVolume * 10) + (usdcVolume * 0.004) + (contracts * 100);
    const allocation = Math.floor((points / 500) * 25000000000);

    res.status(200).json({
      summary: `You have ${txCount} transactions, ${ethVolume.toFixed(2)} ETH, ${usdcVolume.toFixed(2)} USDC volume and deployed ${contracts} contracts on Base.`,
      allocation: allocation.toLocaleString(),
      stats: { txCount, ethVolume, usdcVolume, contracts }
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Server error fetching on-chain data" });
  }
}
```

### Fix 3: Test with a Valid Address

Try this test URL with a known valid Base address:
```
https://base-dummy-airdrop-checker.vercel.app/api/check-wallet?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
