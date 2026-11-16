import os from 'os';

// The address `studio remote` binds and advertises unless `--host` names one.
export function getDefaultLanAddress(
	interfaces: NodeJS.Dict< os.NetworkInterfaceInfo[] > = os.networkInterfaces()
): string | undefined {
	for ( const addresses of Object.values( interfaces ) ) {
		for ( const candidate of addresses ?? [] ) {
			if ( candidate.family === 'IPv4' && ! candidate.internal ) {
				return candidate.address;
			}
		}
	}
	return undefined;
}
