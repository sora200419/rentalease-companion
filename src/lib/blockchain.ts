// src/lib/blockchain.ts
// Server-only — never import from a 'use client' component.
// Handles broadcasting document hashes to the Ethereum Sepolia testnet.

import { ethers } from 'ethers';

// ── anchorHashToBlockchain ──────────────────────────────────────────────────
//
// Takes the SHA-256 hex string of a signed agreement and embeds it as the
// data payload of a zero-value Ethereum transaction on the Sepolia testnet.
//
// Why this works as proof:
//   - Every Ethereum transaction is permanently stored on thousands of nodes
//     worldwide. No single party — including us — can delete or modify it.
//   - The transaction's data field contains our document hash. Anyone can
//     decode it and verify it matches the stored rawContent.
//   - The transaction timestamp is set by the network, not by us, so it
//     cannot be backdated.
//
// Returns the transaction hash (txHash), which is the 66-character hex string
// that can be looked up at https://sepolia.etherscan.io/tx/{txHash}.
//
// Throws if the broadcast fails — the caller should handle this gracefully
// and not block the signing flow on a blockchain failure.

export async function anchorHashToBlockchain(
  contentHash: string,
): Promise<string> {
  if (!process.env.BLOCKCHAIN_PRIVATE_KEY) {
    throw new Error(
      'BLOCKCHAIN_PRIVATE_KEY is not set in environment variables',
    );
  }
  if (!process.env.SEPOLIA_RPC_URL) {
    throw new Error('SEPOLIA_RPC_URL is not set in environment variables');
  }

  // JsonRpcProvider connects to Sepolia over HTTPS.
  // We use Sepolia (chain ID 11155111) rather than mainnet — testnet ETH is
  // free from faucets and the chain has the same security properties for our
  // proof-of-existence use case.
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

  // The wallet holds the private key of the anchoring account.
  // This account needs a small amount of Sepolia ETH to pay gas fees.
  // We use a dedicated anchoring wallet — never the same key as any user wallet.
  const wallet = new ethers.Wallet(
    process.env.BLOCKCHAIN_PRIVATE_KEY,
    provider,
  );

  // We embed a human-readable prefix alongside the hash so that the transaction
  // data is self-describing. Anyone inspecting the raw transaction bytes can
  // decode the UTF-8 string and immediately understand what they're looking at.
  //
  // Format: "RentalEase:sha256:<64-char-hex-hash>"
  // Total message length: 80 characters → 80 bytes as UTF-8
  const message = `RentalEase:sha256:${contentHash}`;

  // Convert our message to a hex-encoded byte string for the transaction data field.
  // ethers.toUtf8Bytes() converts the string to a Uint8Array of UTF-8 bytes.
  // ethers.hexlify() converts that to a 0x-prefixed hex string that Ethereum expects.
  const data = ethers.hexlify(ethers.toUtf8Bytes(message));

  // Send the transaction.
  // - to: our own wallet address (we're not paying anyone, just writing data)
  // - value: 0n (zero ETH transferred — BigInt literal, required by ethers v6)
  // - data: the hex-encoded document hash
  //
  // Gas is still consumed for the data bytes (4 gas per zero byte, 16 per non-zero),
  // so a ~80-byte message costs roughly 1,280–1,920 extra gas beyond the base 21,000.
  // At typical Sepolia gas prices this is about 0.000001–0.000002 ETH per anchoring.
  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: 0,
    data,
  });

  // We return the transaction hash immediately after broadcast, WITHOUT waiting
  // for the transaction to be mined (confirmed into a block). This is intentional:
  //   - tx.hash is deterministically derived from the transaction content and is
  //     already final at broadcast time — it will not change when mined.
  //   - Waiting for a block (~12 seconds on Sepolia) would delay the API response
  //     by an unacceptable amount for a signing action.
  //   - The pending transaction is already publicly visible on Etherscan.
  return tx.hash;
}

// ── verifyHashOnChain (utility for FYP demonstration) ────────────────────────
//
// Given a txHash, fetches the transaction from Sepolia and decodes the embedded
// document hash. Returns the decoded hash string if found, or null if the
// transaction doesn't contain a RentalEase hash.
//
// This function is not called in the main flow but is useful for:
//   (a) FYP Chapter 5 — demonstrating that the hash is genuinely recoverable
//   (b) A future admin verification panel
//
export async function verifyHashOnChain(
  txHash: string,
): Promise<string | null> {
  if (!process.env.SEPOLIA_RPC_URL) return null;

  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const tx = await provider.getTransaction(txHash);

    if (!tx || !tx.data || tx.data === '0x') return null;

    // Decode the hex data field back to a UTF-8 string
    const decoded = ethers.toUtf8String(tx.data);

    // Check it matches our format and extract the hash
    const match = decoded.match(/^RentalEase:sha256:([a-f0-9]{64})$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
