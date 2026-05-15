import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeStore = 'app_store' | 'google_play';

export type NativeBillingProduct = {
	productId: string;
	title?: string;
	description?: string;
	price?: string;
	currencyCode?: string;
};

export type NativeBillingPurchase = {
	store: NativeStore;
	productId: string;
	purchaseToken?: string;
	originalTransactionId?: string;
	transactionId?: string;
	signedTransactionJws?: string;
};

type CriminiBillingPlugin = {
	getProducts(options: { productIds: string[] }): Promise<{ products: NativeBillingProduct[] }>;
	purchase(options: { productId: string }): Promise<NativeBillingPurchase>;
	restorePurchases(): Promise<{ purchases: NativeBillingPurchase[] }>;
};

export const CriminiBilling = registerPlugin<CriminiBillingPlugin>('CriminiBilling');

export function nativeStoreForPlatform(): NativeStore | null {
	const platform = Capacitor.getPlatform();
	if (platform === 'ios') return 'app_store';
	if (platform === 'android') return 'google_play';
	return null;
}

export function isNativeBillingAvailable() {
	return nativeStoreForPlatform() !== null;
}
