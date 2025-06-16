// index.ts file

import {
  DEFAULT_SUI_ERROR_CODES,
  TRANSACTION_ERROR_CODES,
} from "./defaultErrors.js";

export interface ErrorCodeMap {
  [key: number]: string;
}

export interface TransactionErrorMap {
  [key: string]: string;
}

export interface SuiErrorDecoderOptions {
  customErrorCodes?: ErrorCodeMap;
  customTransactionErrors?: TransactionErrorMap;
  includeDefaults?: boolean;
}

export interface ParsedError {
  code?: number;
  errorType?: string;
  message: string;
  isKnownError: boolean;
  category: "move_abort" | "transaction" | "sui_system" | "unknown";
  originalError: any;
}

export class SuiClientErrorDecoder {
  private errorCodes: ErrorCodeMap;
  private transactionErrors: TransactionErrorMap;

  constructor(options: SuiErrorDecoderOptions = {}) {
    const {
      customErrorCodes = {},
      customTransactionErrors = {},
      includeDefaults = true,
    } = options;

    this.errorCodes = includeDefaults
      ? { ...DEFAULT_SUI_ERROR_CODES, ...customErrorCodes }
      : customErrorCodes;

    this.transactionErrors = includeDefaults
      ? { ...TRANSACTION_ERROR_CODES, ...customTransactionErrors }
      : customTransactionErrors;
  }

  /**
   * Add or update custom error codes
   */
  public addErrorCodes(errorCodes: ErrorCodeMap): void {
    this.errorCodes = { ...this.errorCodes, ...errorCodes };
  }

  /**
   * Add or update custom transaction errors
   */
  public addTransactionErrors(transactionErrors: TransactionErrorMap): void {
    this.transactionErrors = {
      ...this.transactionErrors,
      ...transactionErrors,
    };
  }

  /**
   * Update the default Sui error codes (useful for package updates)
   */
  public updateDefaultErrorCodes(defaultCodes: ErrorCodeMap): void {
    // Replace only the default codes, preserve custom ones
    const customCodes = this.getCustomErrorCodes();
    this.errorCodes = { ...defaultCodes, ...customCodes };
  }

  /**
   * Update the default transaction error codes
   */
  public updateDefaultTransactionErrors(
    defaultTransactionErrors: TransactionErrorMap
  ): void {
    const customTransactionErrors = this.getCustomTransactionErrors();
    this.transactionErrors = {
      ...defaultTransactionErrors,
      ...customTransactionErrors,
    };
  }

  /**
   * Get all error codes currently in use
   */
  public getErrorCodes(): ErrorCodeMap {
    return { ...this.errorCodes };
  }

  /**
   * Get all transaction errors currently in use
   */
  public getTransactionErrors(): TransactionErrorMap {
    return { ...this.transactionErrors };
  }

  /**
   * Get only custom error codes (excluding defaults)
   */
  private getCustomErrorCodes(): ErrorCodeMap {
    const customCodes: ErrorCodeMap = {};
    for (const [code, message] of Object.entries(this.errorCodes)) {
      if (!DEFAULT_SUI_ERROR_CODES[parseInt(code)]) {
        customCodes[parseInt(code)] = message;
      }
    }
    return customCodes;
  }

  /**
   * Get only custom transaction errors (excluding defaults)
   */
  private getCustomTransactionErrors(): TransactionErrorMap {
    const customErrors: TransactionErrorMap = {};
    for (const [errorType, message] of Object.entries(this.transactionErrors)) {
      if (!TRANSACTION_ERROR_CODES[errorType]) {
        customErrors[errorType] = message;
      }
    }
    return customErrors;
  }

  /**
   * Parse and decode a Sui transaction error
   */
  public parseError(error: any): ParsedError {
    const errorString = this.extractErrorString(error);

    // First, check for transaction error types (string-based)
    const transactionError = this.checkTransactionErrors(errorString);
    if (transactionError) {
      return {
        errorType: transactionError.errorType,
        message: transactionError.message,
        isKnownError: true,
        category: "transaction",
        originalError: error,
      };
    }

    // Try to extract numeric error code
    const errorCode = this.extractErrorCode(errorString);

    if (errorCode !== null) {
      const message = this.errorCodes[errorCode];
      if (message) {
        return {
          code: errorCode,
          message: `Error Code ${errorCode}: ${message}`,
          isKnownError: true,
          category: this.categorizeError(errorCode, errorString),
          originalError: error,
        };
      } else {
        return {
          code: errorCode,
          message: `Move Error Code ${errorCode}: Unknown error occurred`,
          isKnownError: false,
          category: "move_abort",
          originalError: error,
        };
      }
    }

    // Check for named errors
    const namedError = this.checkNamedErrors(errorString);
    if (namedError) {
      return {
        message: namedError.message,
        isKnownError: true,
        category: namedError.category,
        originalError: error,
      };
    }

    // Check for common system failures
    const systemError = this.checkSystemErrors(errorString);
    if (systemError) {
      return {
        message: systemError.message,
        isKnownError: true,
        category: systemError.category,
        originalError: error,
      };
    }

    // Return original error if we can't parse it
    return {
      message: errorString || "An unexpected error occurred",
      isKnownError: false,
      category: "unknown",
      originalError: error,
    };
  }

  /**
   * Check for transaction errors (string-based error types)
   */
  private checkTransactionErrors(
    errorString: string
  ): { errorType: string; message: string } | null {
    // Check for exact matches with transaction error keys
    for (const [errorType, message] of Object.entries(this.transactionErrors)) {
      if (errorString.includes(errorType)) {
        return {
          errorType,
          message: `Transaction Error (${errorType}): ${message}`,
        };
      }
    }

    // Check for common transaction error patterns
    const transactionPatterns = [
      {
        pattern: /insufficient.*gas/i,
        errorType: "INSUFFICIENT_GAS",
        message:
          this.transactionErrors.INSUFFICIENT_GAS ||
          "Insufficient gas for transaction",
      },
      {
        pattern: /invalid.*gas.*object/i,
        errorType: "INVALID_GAS_OBJECT",
        message:
          this.transactionErrors.INVALID_GAS_OBJECT || "Invalid gas object",
      },
      {
        pattern: /object.*too.*big/i,
        errorType: "OBJECT_TOO_BIG",
        message: this.transactionErrors.OBJECT_TOO_BIG || "Object is too large",
      },
      {
        pattern: /package.*too.*big/i,
        errorType: "PACKAGE_TOO_BIG",
        message:
          this.transactionErrors.PACKAGE_TOO_BIG || "Package is too large",
      },
      {
        pattern: /circular.*ownership/i,
        errorType: "CIRCULAR_OBJECT_OWNERSHIP",
        message:
          this.transactionErrors.CIRCULAR_OBJECT_OWNERSHIP ||
          "Circular object ownership detected",
      },
      {
        pattern: /insufficient.*coin.*balance/i,
        errorType: "INSUFFICIENT_COIN_BALANCE",
        message:
          this.transactionErrors.INSUFFICIENT_COIN_BALANCE ||
          "Insufficient coin balance",
      },
      {
        pattern: /function.*not.*found/i,
        errorType: "FUNCTION_NOT_FOUND",
        message:
          this.transactionErrors.FUNCTION_NOT_FOUND || "Function not found",
      },
      {
        pattern: /move.*abort/i,
        errorType: "MOVE_ABORT",
        message: this.transactionErrors.MOVE_ABORT || "Move runtime abort",
      },
    ];

    for (const { pattern, errorType, message } of transactionPatterns) {
      if (pattern.test(errorString)) {
        return {
          errorType,
          message: `Transaction Error (${errorType}): ${message}`,
        };
      }
    }

    return null;
  }

  /**
   * Extract error string from various error formats
   */
  private extractErrorString(error: any): string {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.toString) return error.toString();
    return String(error) || "";
  }

  /**
   * Extract error code using regex patterns
   */
  private extractErrorCode(errorString: string): number | null {
    const patterns = [
      // Standard MoveAbort patterns
      /MoveAbort\([^,]+,\s*(\d+)\)/,
      /MoveAbort\([^)]+\)\s*,\s*(\d+)\)/,
      /}, (\d+)\) in command/,
      /abort_code:\s*(\d+)/,
      /error_code:\s*(\d+)/,

      // Protocol-specific patterns
      /CetusError\((\d+)\)/,
      /PoolCreationError\((\d+)\)/,
      /InsufficientLiquidity\((\d+)\)/,
      /LaunchpadError\((\d+)\)/,

      // Generic error code patterns
      /Error\s*Code\s*(\d+)/i,
      /ErrorCode:?\s*(\d+)/i,
      /code[:\s]*(\d+)/i,
      /error[:\s]*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = errorString.match(pattern);
      if (match) {
        const code = parseInt(match[1]);
        if (!isNaN(code)) {
          return code;
        }
      }
    }

    return null;
  }

  /**
   * Check for named errors (non-numeric)
   */
  private checkNamedErrors(
    errorString: string
  ): { message: string; category: ParsedError["category"] } | null {
    const namedErrors = [
      {
        pattern: /EInvalidTickRange/,
        message: "Invalid tick range for liquidity pool",
        category: "move_abort" as const,
      },
      {
        pattern: /EInvalidLiquidity/,
        message: "Invalid liquidity amount",
        category: "move_abort" as const,
      },
      {
        pattern: /EInvalidTickSpacing/,
        message: "Invalid tick spacing - must be 100, 500, or 3000",
        category: "move_abort" as const,
      },
      {
        pattern: /ETickNotAligned/,
        message: "Tick not aligned with tick spacing",
        category: "move_abort" as const,
      },
      {
        pattern: /EInsufficientLiquidity/,
        message: "Insufficient liquidity for pool creation",
        category: "move_abort" as const,
      },
      {
        pattern: /EInvalidPrice/,
        message: "Invalid price for pool creation",
        category: "move_abort" as const,
      },
      {
        pattern: /EInvalidPhase/,
        message: "Invalid phase for operation",
        category: "move_abort" as const,
      },
      {
        pattern: /EUnauthorized/,
        message: "Unauthorized access",
        category: "move_abort" as const,
      },
    ];

    for (const { pattern, message, category } of namedErrors) {
      if (pattern.test(errorString)) {
        return { message: `Error: ${message}`, category };
      }
    }

    return null;
  }

  /**
   * Check for system-level errors
   */
  private checkSystemErrors(
    errorString: string
  ): { message: string; category: ParsedError["category"] } | null {
    const systemErrors = [
      {
        pattern: /InsufficientGas/,
        message:
          "Insufficient gas for transaction. Please increase gas budget.",
        category: "sui_system" as const,
      },
      {
        pattern: /ObjectNotFound/,
        message: "Required object not found. Please check object IDs.",
        category: "sui_system" as const,
      },
      {
        pattern: /InvalidObjectOwner/,
        message: "Invalid object ownership. Please verify permissions.",
        category: "sui_system" as const,
      },
      {
        pattern: /PackageNotFound/,
        message:
          "Smart contract package not found. Please check package deployment.",
        category: "sui_system" as const,
      },
      {
        pattern: /TransactionExpired/,
        message: "Transaction expired. Please try again.",
        category: "transaction" as const,
      },
      {
        pattern: /InvalidSignature/,
        message: "Invalid transaction signature.",
        category: "transaction" as const,
      },
    ];

    for (const { pattern, message, category } of systemErrors) {
      if (pattern.test(errorString)) {
        return { message, category };
      }
    }

    return null;
  }

  /**
   * Categorize error based on code range or content
   */
  private categorizeError(
    errorCode: number,
    errorString: string
  ): ParsedError["category"] {
    // Move abort errors (1000-1999)
    if (errorCode >= 1000 && errorCode <= 1999) {
      return "move_abort";
    }

    // Sui system errors (2000-2999)
    if (errorCode >= 2000 && errorCode <= 2999) {
      return "sui_system";
    }

    // Binary/serialization errors (3000+)
    if (errorCode >= 3000) {
      return "sui_system";
    }

    // Custom error codes (1-999)
    if (errorCode >= 1 && errorCode <= 999) {
      return "move_abort";
    }

    // Check content for category hints
    if (
      errorString.includes("Transaction") ||
      errorString.includes("Signature")
    ) {
      return "transaction";
    }

    return "move_abort";
  }

  /**
   * Convenience method to get just the error message
   */
  public decodeError(error: any): string {
    return this.parseError(error).message;
  }

  /**
   * Check if an error code is known
   */
  public isKnownErrorCode(code: number): boolean {
    return code in this.errorCodes;
  }

  /**
   * Check if a transaction error type is known
   */
  public isKnownTransactionError(errorType: string): boolean {
    return errorType in this.transactionErrors;
  }

  /**
   * Get error message for a specific code
   */
  public getErrorMessage(code: number): string | null {
    return this.errorCodes[code] || null;
  }

  /**
   * Get transaction error message for a specific error type
   */
  public getTransactionErrorMessage(errorType: string): string | null {
    return this.transactionErrors[errorType] || null;
  }
}

// Export default instance for convenience
export const defaultDecoder = new SuiClientErrorDecoder();

// Export the decode function for one-liner usage
export function decodeSuiError(
  error: any,
  customCodes?: ErrorCodeMap,
  customTransactionErrors?: TransactionErrorMap
): string {
  if (customCodes || customTransactionErrors) {
    const decoder = new SuiClientErrorDecoder({
      customErrorCodes: customCodes,
      customTransactionErrors: customTransactionErrors,
    });
    return decoder.decodeError(error);
  }
  return defaultDecoder.decodeError(error);
}

export {
  DEFAULT_SUI_ERROR_CODES,
  TRANSACTION_ERROR_CODES,
} from "./defaultErrors.js";
