import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps all successful responses in the standard format:
 * { success: true, data: ..., meta?: ... }
 *
 * This matches the API Reference convention (04_API_REFERENCE.md).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
    intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<any> {
        return next.handle().pipe(
            map((data: any) => {
                // If the response already has a 'success' field, pass through
                if (data && typeof data === 'object' && 'success' in data) {
                    return data;
                }

                // Extract meta from data if present (pagination)
                const meta = data?.meta;
                const responseData = data?.meta ? data.data : data;

                return {
                    success: true,
                    data: responseData,
                    ...(meta && { meta }),
                };
            }),
        );
    }
}
