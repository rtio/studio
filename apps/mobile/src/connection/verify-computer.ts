import { z } from 'zod';
import { createApiClient, HttpError } from './api-client';
import type { FetchLike } from './api-client';

// Something answers at the paired address, but it is not the paired computer:
// another Studio, another device that got the same address, or a Wi-Fi sign-in
// page.
export class WrongComputerError extends Error {
	constructor() {
		super( 'Another computer answers at the paired address' );
		this.name = 'WrongComputerError';
	}
}

const descriptorSchema = z.object( { instanceId: z.string().min( 1 ) } );

// Asks who answers at the paired address, with no device token in the request.
// The phone calls this before it sends the token, so the token only ever goes
// to the computer it was paired with. Throws WrongComputerError, or
// UnreachableError when nothing answers.
export async function verifyComputer(
	paired: { baseUrl: string; instanceId: string },
	fetch: FetchLike,
	signal?: AbortSignal
): Promise< void > {
	let answer: unknown;
	try {
		answer = await createApiClient( { baseUrl: paired.baseUrl, fetch } ).get(
			'/.well-known/studio/remote',
			{ signal }
		);
	} catch ( error ) {
		if ( error instanceof HttpError ) {
			throw new WrongComputerError();
		}
		throw error;
	}
	const descriptor = descriptorSchema.safeParse( answer );
	if ( ! descriptor.success || descriptor.data.instanceId !== paired.instanceId ) {
		throw new WrongComputerError();
	}
}
