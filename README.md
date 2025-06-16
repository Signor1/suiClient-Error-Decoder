# SuiClient Error Decoder

[![npm version](https://img.shields.io/npm/v/suiclient-error-decoder.svg?style=flat-square)](https://www.npmjs.com/package/suiclient-error-decoder)
[![npm downloads](https://img.shields.io/npm/dm/suiclient-error-decoder.svg?style=flat-square)](https://npm-stat.com/charts.html?package=suiclient-error-decoder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Sui Blockchain](https://img.shields.io/badge/Built%20for-Sui%20Blockchain-6FBCF0.svg?style=flat-square)](https://sui.io)
[![Move](https://img.shields.io/badge/Move-008080?style=flat-square&logo=rust&logoColor=white)](https://move-language.github.io/move/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**SuiClient Error Decoder** is a robust error decoding toolkit for Sui blockchain developers. Intelligently parses Move abort codes, system errors, and transaction failures with zero dependencies. Features customizable error mappings, automatic error categorization, and Sui-specific pattern recognition to simplify debugging and improve user feedback in dApps.

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
```

## Usage

### Basic Usage

```typescript
import { SuiClientErrorDecoder, decodeSuiError } from 'suiclient-error-decoder';

// Create an instance with default error codes
const decoder = new SuiClientErrorDecoder();

// Example error (in real usage, this would be caught from a transaction)
const error = new Error('MoveAbort(0x123, 7) in command');

// Parse the error
const parsed = decoder.parseError(error);
console.log(parsed.message); // "Error Code 7: Insufficient balance or resources"

// Or use the convenience function
const message = decodeSuiError(error);
console.log(message); // same as above
```

### Adding Custom Error Codes

```typescript
const customDecoder = new SuiClientErrorDecoder({
  customErrorCodes: {
    10000: "My custom error",
  },
});

const error = new Error('MoveAbort(0x123, 10000)');
console.log(customDecoder.decodeError(error)); // "Error Code 10000: My custom error"
```

### Using with Sui dApp Kit

```typescript
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SuiClientErrorDecoder } from 'suiclient-error-decoder';

function MyComponent() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const decoder = new SuiClientErrorDecoder();

  const handleTransaction = async () => {
    try {
      await signAndExecute(/* ... */);
    } catch (error) {
      const decoded = decoder.parseError(error);
      console.error(decoded.message);
    }
  };
  
  // ...
}
```

## API Reference

### `SuiClientErrorDecoder`

#### Constructor

```typescript
new SuiClientErrorDecoder(options?: {
  customErrorCodes?: Record<number, string>;
  includeDefaults?: boolean; // Default: true
})
```

#### Methods

- `parseError(error: any): ParsedError`
- `decodeError(error: any): string`
- `addErrorCodes(codes: Record<number, string>): void`
- `updateDefaultErrorCodes(codes: Record<number, string>): void`
- `getErrorCodes(): Record<number, string>`

### `ParsedError` Object

```typescript
{
  code?: number;
  message: string;
  isKnownError: boolean;
  category: 'move_abort' | 'transaction' | 'sui_system' | 'unknown';
  originalError: any;
}
```

## Error Categories

| Category       | Description                               | Example Error Codes |
|----------------|-------------------------------------------|---------------------|
| `move_abort`   | Errors from Move smart contracts          | 1-999              |
| `sui_system`   | Sui node/system-level errors             | 1000-1999          |
| `transaction`  | Transaction processing errors            | 2000-2999          |
| `unknown`      | Unrecognized error patterns              | N/A                |

## Contributing

Contributions are welcome! Please open an issue or submit a PR:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Support

For support, please open an issue on our [GitHub repository](https://github.com/Signor1/suiClient-Error-Decoder/issues)
