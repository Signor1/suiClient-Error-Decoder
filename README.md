# SuiClient Error Decoder

[![npm version](https://img.shields.io/npm/v/suiclient-error-decoder.svg?style=flat-square)](https://www.npmjs.com/package/suiclient-error-decoder)
[![npm downloads](https://img.shields.io/npm/dm/suiclient-error-decoder.svg?style=flat-square)](https://npm-stat.com/charts.html?package=suiclient-error-decoder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Sui Blockchain](https://img.shields.io/badge/Built%20for-Sui%20Blockchain-6FBCF0.svg?style=flat-square)](https://sui.io)
[![Move](https://img.shields.io/badge/Move-008080?style=flat-square&logo=rust&logoColor=white)](https://move-language.github.io/move/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**SuiClient Error Decoder** is a robust error decoding toolkit for Sui blockchain developers. Intelligently parses Move abort codes, system errors, and transaction failures with zero dependencies. Features customizable error mappings, automatic error categorization, and Sui-specific pattern recognition to simplify debugging and improve user feedback in dApps.

[npmjs.com/package/suiclient-error-decoder](https://www.npmjs.com/package/suiclient-error-decoder)

## Features

- 🔍 **Comprehensive Error Parsing**: Handles Move abort codes, named errors, and system errors
- 🎯 **Custom Error Codes**: Add your own project-specific error codes
- 📊 **Error Categorization**: Categorizes errors into move_abort, transaction, sui_system, or unknown
- 🔄 **Updatable Defaults**: Built-in Sui error codes that can be updated
- 💡 **Zero Dependencies**: Lightweight and easy to integrate

## Installation

```bash
npm install suiclient-error-decoder
# or
yarn add suiclient-error-decoder
# or
pnpm add suiclient-error-decoder
```

## Quick Start

```typescript
import { decodeSuiError, SuiClientErrorDecoder } from 'suiclient-error-decoder';

// Quick one-liner decoding
try {
  // Your Sui transaction code here
  await suiClient.executeTransactionBlock(/* ... */);
} catch (error) {
  const humanReadableError = decodeSuiError(error);
  console.error(humanReadableError);
  // Output: "Error Code 1001: Index out of bounds"
}
```

## Usage Examples

### 1. Basic Setup and Usage

```typescript
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

// Initialize the decoder
const errorDecoder = new SuiClientErrorDecoder();
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

// Example: Decoding a transaction error
async function transferSui(recipientAddress: string, amount: number) {
  try {
    const txb = new Transaction();
    const [coin] = txb.splitCoins(txb.gas, [amount]);
    txb.transferObjects([coin], recipientAddress);
    
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: txb,
      signer: keypair, // your keypair
    });
    
    console.log('Transfer successful:', result.digest);
  } catch (error) {
    // Raw error might be: "MoveAbort(0x2::coin, 0) at instruction 15"
    const decodedError = errorDecoder.parseError(error);
    
    console.error('Transaction failed:');
    console.error('- Code:', decodedError.code); // 0
    console.error('- Message:', decodedError.message); // "Error Code 0: Insufficient balance"
    console.error('- Category:', decodedError.category); // "move_abort"
    console.error('- Known Error:', decodedError.isKnownError); // true
  }
}
```

### 2. DeFi Pool Interaction with Custom Errors

```typescript
// ...other imports
import { Transaction } from "@mysten/sui/transactions";
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

// Setup decoder with DeFi-specific error codes
const defiDecoder = new SuiClientErrorDecoder({
  customErrorCodes: {
    // Pool-specific errors
    100: "Pool does not exist",
    101: "Insufficient liquidity in pool",
    102: "Slippage tolerance exceeded",
    103: "Pool is paused for maintenance",
    104: "Invalid token pair",
    
    // Staking errors
    200: "Staking period not yet ended",
    201: "Rewards already claimed",
    202: "Minimum stake amount not met",
    203: "Unstaking cooldown period active",
  }
});

async function swapTokens(tokenA: string, tokenB: string, amountIn: number) {
  try {
    const txb = new Transaction();
    
    // Add your DeFi swap logic here
    txb.moveCall({
      target: '0x123::dex::swap',
      arguments: [
        txb.pure(tokenA),
        txb.pure(tokenB),
        txb.pure(amountIn)
      ],
      typeArguments: ['0x2::sui::SUI', '0x456::usdc::USDC']
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: { showEffects: true }
    });
    
    return result;
  } catch (error) {
    const decoded = defiDecoder.parseError(error);
    
    // Handle specific DeFi errors
    if (decoded.code === 101) {
      throw new Error('Not enough liquidity in the pool. Try a smaller amount.');
    } else if (decoded.code === 102) {
      throw new Error('Price moved too much. Increase slippage tolerance.');
    } else {
      throw new Error(`Swap failed: ${decoded.message}`);
    }
  }
}
```

### 3. React Hook Integration

```typescript
import { useState } from 'react';
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

// Custom hook for error handling
function useErrorDecoder() {
  const decoder = new SuiClientErrorDecoder({
    customErrorCodes: {
      404: "NFT not found",
      405: "NFT already minted",
      406: "Mint limit exceeded",
    }
  });
  
  return decoder;
}

function MintNFTComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const errorDecoder = useErrorDecoder();

  const mintNFT = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: '0x123::nft::mint',
        arguments: [txb.pure('My NFT Name')]
      });
      
      const result = await signAndExecute({
        transactionBlock: txb,
        options: { showEffects: true }
      });
      
      console.log('NFT minted successfully:', result.digest);
    } catch (rawError) {
      const decoded = errorDecoder.parseError(rawError);
      
      // Set user-friendly error message
      setError(decoded.message);
      
      // Log detailed error for debugging
      console.error('Mint failed:', {
        code: decoded.code,
        category: decoded.category,
        isKnown: decoded.isKnownError,
        original: decoded.originalError
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button onClick={mintNFT} disabled={isLoading}>
        {isLoading ? 'Minting...' : 'Mint NFT'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### 4. Advanced Error Handling with Categorization

```typescript
// ...imports
import { Transaction } from "@mysten/sui/transactions";
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

const decoder = new SuiClientErrorDecoder();

async function handleComplexTransaction() {
  try {
    // Your complex transaction logic
    const txb = new Transaction();
    // ... transaction setup
    
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: txb,
      signer: keypair
    });
    
    return result;
  } catch (error) {
    const decoded = decoder.parseError(error);
    
    // Handle different error categories
    switch (decoded.category) {
      case 'move_abort':
        console.error('Smart contract error:', decoded.message);
        // Maybe retry with different parameters
        break;
        
      case 'transaction':
        console.error('Transaction processing error:', decoded.message);
        // Maybe increase gas or check network
        break;
        
      case 'sui_system':
        console.error('Sui system error:', decoded.message);
        // Maybe retry after some time
        break;
        
      default:
        console.error('Unknown error occurred:', decoded.message);
        // Log for investigation
        break;
    }
    
    // Re-throw with user-friendly message
    throw new Error(decoded.message);
  }
}
```

### 5. Batch Transaction Error Handling

```typescript
async function processBatchTransactions(transactions: TransactionBlock[]) {
  const decoder = new SuiClientErrorDecoder();
  const results = [];
  const errors = [];

  for (let i = 0; i < transactions.length; i++) {
    try {
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: transactions[i],
        signer: keypair
      });
      
      results.push({ index: i, success: true, result });
    } catch (error) {
      const decoded = decoder.parseError(error);
      
      errors.push({
        index: i,
        success: false,
        error: {
          code: decoded.code,
          message: decoded.message,
          category: decoded.category,
          isKnown: decoded.isKnownError
        }
      });
      
      // Continue with next transaction instead of stopping
      console.warn(`Transaction ${i} failed: ${decoded.message}`);
    }
  }

  return { results, errors };
}
```

### 6. Error Monitoring and Analytics

```typescript
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

class ErrorAnalytics {
  private decoder: SuiClientErrorDecoder;
  private errorCounts: Map<string, number> = new Map();

  constructor() {
    this.decoder = new SuiClientErrorDecoder();
  }

  async executeWithAnalytics(transactionFn: () => Promise<any>) {
    try {
      return await transactionFn();
    } catch (error) {
      const decoded = this.decoder.parseError(error);
      
      // Track error frequency
      const errorKey = `${decoded.category}:${decoded.code || 'unknown'}`;
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
      
      // Send to analytics service
      this.sendToAnalytics({
        timestamp: Date.now(),
        errorCode: decoded.code,
        errorMessage: decoded.message,
        category: decoded.category,
        isKnownError: decoded.isKnownError
      });
      
      throw error; // Re-throw the original error
    }
  }

  private async sendToAnalytics(errorData: any) {
    // Send to your analytics service
    console.log('Error Analytics:', errorData);
  }

  getErrorStats() {
    return Object.fromEntries(this.errorCounts);
  }
}

// Usage
const analytics = new ErrorAnalytics();

await analytics.executeWithAnalytics(async () => {
  // Your transaction code
  return await performSuiTransaction();
});

console.log('Error statistics:', analytics.getErrorStats());
```

### 7. Testing Error Scenarios

```typescript
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

describe('Error Handling Tests', () => {
  const decoder = new SuiClientErrorDecoder({
    customErrorCodes: {
      999: "Test error for unit testing"
    }
  });

  test('should handle insufficient gas error', () => {
    const mockError = new Error('InsufficientGas: Transaction needs more gas');
    const decoded = decoder.parseError(mockError);
    
    expect(decoded.category).toBe('sui_system');
    expect(decoded.isKnownError).toBe(true);
    expect(decoded.message).toContain('gas');
  });

  test('should handle custom error codes', () => {
    const mockError = new Error('MoveAbort(0x123, 999)');
    const decoded = decoder.parseError(mockError);
    
    expect(decoded.code).toBe(999);
    expect(decoded.message).toContain('Test error for unit testing');
    expect(decoded.isKnownError).toBe(true);
  });

  test('should handle unknown errors gracefully', () => {
    const mockError = new Error('Some unknown error');
    const decoded = decoder.parseError(mockError);
    
    expect(decoded.category).toBe('unknown');
    expect(decoded.isKnownError).toBe(false);
    expect(typeof decoded.message).toBe('string');
  });
});
```

## API Reference

### `SuiClientErrorDecoder`

#### Constructor

```typescript
new SuiClientErrorDecoder(options?: {
  customErrorCodes?: Record<number, string>;
  customTransactionErrors?: Record<string, string>;
  includeDefaults?: boolean; // Default: true
})
```

#### Methods

- `parseError(error: any): ParsedError` - Parse and categorize error
- `decodeError(error: any): string` - Get human-readable error message
- `addErrorCodes(codes: Record<number, string>): void` - Add custom error codes
- `addTransactionErrors(errors: Record<string, string>): void` - Add transaction errors
- `getErrorCodes(): Record<number, string>` - Get all error codes
- `isKnownErrorCode(code: number): boolean` - Check if error code is known

### `ParsedError` Object

```typescript
interface ParsedError {
  code?: number;                    // Numeric error code (if available)
  errorType?: string;              // Transaction error type (if available)
  message: string;                 // Human-readable error message
  isKnownError: boolean;          // Whether error is recognized
  category: 'move_abort' | 'transaction' | 'sui_system' | 'unknown';
  originalError: any;             // Original error object for debugging
}
```

### Utility Functions

```typescript
// Quick error decoding without creating decoder instance
decodeSuiError(error: any, customCodes?: Record<number, string>): string

// Default decoder instance
import { defaultDecoder } from 'suiclient-error-decoder';
```

## Error Categories

| Category       | Description                               | Example Error Codes |
|----------------|-------------------------------------------|---------------------|
| `move_abort`   | Errors from Move smart contracts          | 1000-1999          |
| `sui_system`   | Sui node/system-level errors             | 2000-2999          |
| `transaction`  | Transaction processing errors            | String-based       |
| `unknown`      | Unrecognized error patterns              | N/A                |

## Best Practices

1. **Always handle errors**: Wrap your Sui transactions in try-catch blocks
2. **Use specific error codes**: Define custom error codes for your smart contracts
3. **Categorize handling**: Handle different error categories appropriately
4. **Log for debugging**: Keep original error objects for development debugging
5. **User-friendly messages**: Show decoded messages to users, not raw errors

## Contributing

Contributions are welcome! Please open an issue or submit a PR:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## Support

For support, please open an issue on our [GitHub repository](https://github.com/Signor1/suiClient-Error-Decoder/issues)
