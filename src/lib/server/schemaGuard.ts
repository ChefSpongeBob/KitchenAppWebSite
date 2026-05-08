type D1 = App.Platform['env']['DB'];

const SCHEMA_MUTATION_PATTERN =
	/^\s*(?:--[^\n]*\n\s*)*(?:CREATE|ALTER|DROP|REINDEX|VACUUM|PRAGMA\s+writable_schema)\b/i;

function summarizeSql(sql: string) {
	return sql.trim().replace(/\s+/g, ' ').slice(0, 140);
}

export function isSchemaMutationSql(sql: string) {
	return SCHEMA_MUTATION_PATTERN.test(sql);
}

function createNoopStatement(sql: string) {
	let values: unknown[] = [];
	const statement = {
		bind(...bindings: unknown[]) {
			values = bindings;
			return statement;
		},
		async first<T = unknown>() {
			void values;
			return null as T | null;
		},
		async all<T = unknown>() {
			void values;
			return {
				results: [] as T[],
				success: true,
				meta: {
					schemaMutationBlocked: true,
					sql: summarizeSql(sql)
				}
			};
		},
		async raw<T = unknown>() {
			void values;
			return [] as T[];
		},
		async run() {
			void values;
			return {
				success: true,
				meta: {
					schemaMutationBlocked: true,
					sql: summarizeSql(sql)
				}
			};
		}
	};
	return statement;
}

export function wrapProductionSchemaGuard(db: D1, allowRuntimeSchemaMutation: boolean) {
	if (allowRuntimeSchemaMutation) return db;

	return new Proxy(db, {
		get(target, prop, receiver) {
			if (prop === 'prepare') {
				return (sql: string) => {
					if (isSchemaMutationSql(sql)) {
						console.warn(
							`Runtime schema mutation blocked in production. Apply migrations before deploy: ${summarizeSql(
								sql
							)}`
						);
						return createNoopStatement(sql);
					}
					return target.prepare(sql);
				};
			}

			if (prop === 'exec') {
				return async (sql: string) => {
					if (isSchemaMutationSql(sql)) {
						console.warn(
							`Runtime schema exec blocked in production. Apply migrations before deploy: ${summarizeSql(
								sql
							)}`
						);
						return { count: 0, duration: 0 };
					}
					return (target as D1 & { exec?: (statement: string) => Promise<unknown> }).exec?.(sql);
				};
			}

			return Reflect.get(target, prop, receiver);
		}
	}) as D1;
}
