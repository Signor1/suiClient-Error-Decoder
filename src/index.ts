// index.ts file

import { DEFAULT_SUI_ERROR_CODES } from "./defaultErrors.js";

export interface ErrorCodeMap {
  [key: number]: string;
}

export interface SuiErrorDecoderOptions {
  customErrorCodes?: ErrorCodeMap;
  includeDefaults?: boolean;
}

export interface ParsedError {
  code?: number;
  message: string;
  isKnownError: boolean;
  category: "move_abort" | "transaction" | "sui_system" | "unknown";
  originalError: any;
}

export class SuiClientErrorDecoder {
  private errorCodes: ErrorCodeMap;

  constructor(options: SuiErrorDecoderOptions = {}) {
    const { customErrorCodes = {}, includeDefaults = true } = options;

    this.errorCodes = includeDefaults
      ? { ...DEFAULT_SUI_ERROR_CODES, ...customErrorCodes }
      : customErrorCodes;
  }

  /**
   * Add or update custom error codes
   */
  public addErrorCodes(errorCodes: ErrorCodeMap): void {
    this.errorCodes = { ...this.errorCodes, ...errorCodes };
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
   * Get all error codes currently in use
   */
  public getErrorCodes(): ErrorCodeMap {
    return { ...this.errorCodes };
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
   * Parse and decode a Sui transaction error
   */
  public parseError(error: any): ParsedError {
    const errorString = this.extractErrorString(error);

    // Try to extract error code using various patterns
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

    // Check for common transaction failures
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
   * Extract error string from various error formats
   */
  private extractErrorString(error: any): string {
    return error?.toString() || error?.message || String(error) || "";
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
    ];

    for (const pattern of patterns) {
      const match = errorString.match(pattern);
      if (match) {
        return parseInt(match[1]);
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
    // Move abort errors typically have codes
    if (errorCode >= 1 && errorCode <= 999) {
      return "move_abort";
    }

    // System errors typically have higher codes
    if (errorCode >= 1000) {
      return "sui_system";
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
   * Get error message for a specific code
   */
  public getErrorMessage(code: number): string | null {
    return this.errorCodes[code] || null;
  }
}

// Export default instance for convenience
export const defaultDecoder = new SuiClientErrorDecoder();

// Export the decode function for one-liner usage
export function decodeSuiError(error: any, customCodes?: ErrorCodeMap): string {
  if (customCodes) {
    const decoder = new SuiClientErrorDecoder({
      customErrorCodes: customCodes,
    });
    return decoder.decodeError(error);
  }
  return defaultDecoder.decodeError(error);
}

export { DEFAULT_SUI_ERROR_CODES } from "./defaultErrors.js";
