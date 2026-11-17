import { createApiClient, UnauthorizedError } from './api-client';
import { verifyComputer } from './verify-computer';
import type { FetchLike } from './api-client';

// Asks the paired computer to remove this phone from its list. Returns whether
// the computer has removed it. It first checks, without the token, that the
// paired computer is the one that answers: when another one does, or none, the
// token is not sent and the phone stays listed.
export async function revokeThisDevice(
	paired: { baseUrl: string; instanceId: string; token: string },
	fetch: FetchLike
): Promise< boolean > {
	try {
		await verifyComputer( paired, fetch );
	} catch {
		return false;
	}
	try {
		await createApiClient( { baseUrl: paired.baseUrl, token: paired.token, fetch } ).delete(
			'/api/remote/devices/current'
		);
		return true;
	} catch ( error ) {
		// A 401 means the computer already removed this phone.
		return error instanceof UnauthorizedError;
	}
}
