import { readRemoteServerInfo } from '@studio/common/lib/remote-access';
import { __ } from '@wordpress/i18n';
import { printPairingCode } from 'cli/lib/remote-pairing';
import { Logger, LoggerError } from 'cli/logger';
import { StudioArgv } from 'cli/types';

function isProcessAlive( pid: number ): boolean {
	try {
		process.kill( pid, 0 );
		return true;
	} catch {
		return false;
	}
}

export async function runCommand(): Promise< void > {
	const logger = new Logger< string >();
	try {
		const server = await readRemoteServerInfo();
		if ( ! server || ! isProcessAlive( server.pid ) ) {
			logger.reportError(
				new LoggerError( __( 'Remote mode is not running. Start it with `studio remote`.' ) )
			);
			return;
		}
		await printPairingCode( server.url );
	} catch ( error ) {
		if ( error instanceof LoggerError ) {
			logger.reportError( error );
		} else {
			logger.reportError( new LoggerError( __( 'Failed to show a pairing code' ), error ) );
		}
	}
}

export const registerCommand = ( yargs: StudioArgv ) => {
	return yargs.command( {
		command: 'pair',
		describe: __( 'Show a new pairing code for the running remote mode' ),
		handler: async () => {
			await runCommand();
		},
	} );
};
