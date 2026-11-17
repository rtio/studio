import * as SecureStore from 'expo-secure-store';
import type { KeyValueStorage } from './storage';

// The Keychain on iOS and the Keystore-backed store on Android. The device token
// lives here.
export const secureStorage: KeyValueStorage = {
	getItem: ( key ) => SecureStore.getItemAsync( key ),
	setItem: ( key, value ) => SecureStore.setItemAsync( key, value ),
	removeItem: ( key ) => SecureStore.deleteItemAsync( key ),
};
