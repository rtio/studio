import { describe, expect, it, vi } from 'vitest';
import { UnreachableError } from './api-client';
import { verifyComputer, WrongComputerError } from './verify-computer';
import type { FetchLike } from './api-client';

const PAIRED = { baseUrl: 'http://10.0.0.5:8082', instanceId: 'instance-1' };

function answering( status: number, payload?: unknown ) {
	return vi.fn< FetchLike >( async () => ( {
		ok: status >= 200 && status < 300,
		status,
		json: async () => payload,
	} ) );
}

describe( 'verifyComputer', () => {
	it( 'passes when the paired computer answers, and sends no device token', async () => {
		const fetch = answering( 200, { instanceId: 'instance-1', label: 'Work laptop' } );

		await expect( verifyComputer( PAIRED, fetch ) ).resolves.toBeUndefined();

		const [ url, init ] = fetch.mock.calls[ 0 ];
		expect( url ).toBe( 'http://10.0.0.5:8082/.well-known/studio/remote' );
		expect( init?.headers ).not.toHaveProperty( 'Authorization' );
	} );

	it( 'refuses another Studio at the same address', async () => {
		const fetch = answering( 200, { instanceId: 'another-computer' } );

		await expect( verifyComputer( PAIRED, fetch ) ).rejects.toBeInstanceOf( WrongComputerError );
	} );

	it( 'refuses something that is not Studio', async () => {
		await expect(
			verifyComputer( PAIRED, answering( 200, '<html>Sign in</html>' ) )
		).rejects.toBeInstanceOf( WrongComputerError );
		await expect( verifyComputer( PAIRED, answering( 404, {} ) ) ).rejects.toBeInstanceOf(
			WrongComputerError
		);
	} );

	it( 'says the computer is unreachable when nothing answers', async () => {
		const fetch = vi.fn< FetchLike >( async () => {
			throw new TypeError( 'Network request failed' );
		} );

		await expect( verifyComputer( PAIRED, fetch ) ).rejects.toBeInstanceOf( UnreachableError );
	} );
} );
