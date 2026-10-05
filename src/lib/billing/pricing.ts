export const PLAN_PRICES = {
	starter: 29,
	growth: 49,
	enterprise: 69
} as const;

export const SENSOR_PRICING = {
	baseMonthly: 17,
	includedSensors: 12,
	additionalSensorMonthly: 2
} as const;

export function sensorMonthlyPrice(sensorCount: number) {
	const normalizedCount = Math.max(0, Math.floor(Number.isFinite(sensorCount) ? sensorCount : 0));
	return (
		SENSOR_PRICING.baseMonthly +
		Math.max(0, normalizedCount - SENSOR_PRICING.includedSensors) *
			SENSOR_PRICING.additionalSensorMonthly
	);
}
