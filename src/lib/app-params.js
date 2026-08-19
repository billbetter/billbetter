const isNode = typeof window === 'undefined';

const getAppParams = () => {
	return {
		appId: 'invoicium-local',
		serverUrl: window.location.origin,
		token: 'local-token',
		fromUrl: isNode ? '' : window.location.href,
		functionsVersion: '1',
	}
}

export const appParams = {
	...getAppParams()
}
