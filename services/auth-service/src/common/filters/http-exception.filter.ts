import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global exception filter that returns errors in the standard format:
 * { success: false, error: { code, message, details? } }
 *
 * This matches the API Reference convention (04_API_REFERENCE.md).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_ERROR';
        let message = 'An unexpected error occurred';
        let details: any = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const resp = exceptionResponse as any;
                message = resp.message || message;
                code = resp.error || resp.code || this.getCodeFromStatus(status);
                details = resp.details || undefined;

                // Handle class-validator errors
                if (Array.isArray(resp.message)) {
                    code = 'VALIDATION_ERROR';
                    message = 'Validation failed';
                    details = resp.message.map((msg: string) => ({
                        message: msg,
                    }));
                }
            }
        }

        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                ...(details && { details }),
            },
        });
    }

    private getCodeFromStatus(status: number): string {
        const statusMap: Record<number, string> = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            423: 'ACCOUNT_LOCKED',
            429: 'RATE_LIMIT_EXCEEDED',
        };
        return statusMap[status] || 'INTERNAL_ERROR';
    }
}
