import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs');

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;

    beforeEach(() => {
        (fs.readFileSync as jest.Mock).mockReturnValue('mock-public-key');
        strategy = new JwtStrategy();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    it('should validate and return payload', () => {
        const payload: JwtPayload = { sub: 'u1', role: 'ADMIN', email: 'e', tenantId: 't', tenantSubdomain: 'd' };
        expect(strategy.validate(payload)).toEqual(payload);
    });

    it('should throw UnauthorizedException if sub is missing', () => {
        const payload: any = { role: 'ADMIN' };
        expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });

    it('should fallback to warning if file missing', () => {
        (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error('missing') });
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const strat = new JwtStrategy();
        expect(strat).toBeDefined();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
