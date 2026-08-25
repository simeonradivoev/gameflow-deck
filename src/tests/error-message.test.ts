import { describe, expect, test } from 'bun:test';
import { getErrorMessage } from '@/bun/utils';

describe('getErrorMessage', () =>
{
    test('preserves native and serialized error messages', () =>
    {
        expect(getErrorMessage(new Error('No profiles found'))).toBe('No profiles found');
        expect(getErrorMessage({ message: 'Butler failed to start' })).toBe('Butler failed to start');
    });

    test('uses Butler API messages when available', () =>
    {
        expect(getErrorMessage(Object.assign(new Error('Internal error'), {
            data: { apiError: { messages: ['No profiles found', 'Sign in to continue'] } }
        }))).toBe('No profiles found; Sign in to continue');
    });

    test('redacts secrets and never serializes opaque objects', () =>
    {
        const message = getErrorMessage(new Error(
            'Failed https://itch.io/download?token=url-secret Authorization: Bearer header-secret api_key=config-secret'
        ));

        expect(message).toContain('https://itch.io/download?[redacted]');
        expect(message).not.toContain('url-secret');
        expect(message).not.toContain('header-secret');
        expect(message).not.toContain('config-secret');
        expect(getErrorMessage({})).toBe('Unknown error');
        expect(getErrorMessage({})).not.toBe('{}');
    });
});
