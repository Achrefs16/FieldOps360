import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;

    beforeEach(() => {
        filter = new HttpExceptionFilter();
    });

    it('should be defined', () => {
        expect(filter).toBeDefined();
    });

    it('should catch generic error', () => {
        const mockResponse: any = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const mockHost: any = {
            switchToHttp: () => ({
                getResponse: () => mockResponse,
            }),
        };

        filter.catch(new Error('Test'), mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            },
        });
    });

    it('should catch HttpException with string response', () => {
        const mockResponse: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const mockHost: any = { switchToHttp: () => ({ getResponse: () => mockResponse }) };

        filter.catch(new HttpException('Error message', 400), mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Error message' },
        });
    });

    it('should catch HttpException with array of messages (validation)', () => {
        const mockResponse: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const mockHost: any = { switchToHttp: () => ({ getResponse: () => mockResponse }) };

        const errorResponse = { message: ['error1', 'error2'] };
        filter.catch(new HttpException(errorResponse, 400), mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: 'VALIDATION_ERROR',
            })
        }));
    });
});
