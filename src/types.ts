export type StrapiOperator =
	| "$eq"
	| "$eqi"
	| "$ne"
	| "$nei"
	| "$lt"
	| "$lte"
	| "$gt"
	| "$gte"
	| "$in"
	| "$notIn"
	| "$contains"
	| "$notContains"
	| "$containsi"
	| "$notContainsi"
	| "$null"
	| "$notNull"
	| "$between"
	| "$startsWith"
	| "$startsWithi"
	| "$endsWith"
	| "$endsWithi"
	| "$or"
	| "$and"
	| "$not";

export type FieldFilterValue<V> = V | Partial<Record<StrapiOperator, V | V[]>>;

export type StrapiFilters<T> = {
	[K in keyof T]?: T[K] extends object
		? StrapiFilters<T[K]> | FieldFilterValue<T[K]>
		: FieldFilterValue<T[K]>;
} & {
	$and?: StrapiFilters<T>[];
	$or?: StrapiFilters<T>[];
	$not?: StrapiFilters<T>;
};

export type PopulateValue<T> =
	| true
	| "*"
	| { populate: Populate<T> }
	| Partial<Record<keyof T, PopulateValue<T[keyof T]>>>;

export type Populate<T> =
	| "*"
	| Partial<Record<keyof T, PopulateValue<T[keyof T]>>>
	| string[];

export type SortDirection = "asc" | "desc";

export type SortField<T> =
	| (keyof T & string)
	| `${keyof T & string}:${SortDirection}`
	| `${string}:${SortDirection}`;

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface QueryParams<T = unknown> {
	filters?: StrapiFilters<T>;
	populate?: Populate<T>;
	fields?: (keyof T)[];
	sort?: SortField<T>[];
	pagination?: {
		page?: number;
		pageSize?: number;
		pageCount?: number;
		withCount?: boolean;
	};
	locale?: string;
	publicationState?: "live" | "preview" | "draft";
}

export interface StrapiResponse<T> {
	data: T[];
	meta?: {
		pagination?: {
			page: number;
			pageSize: number;
			pageCount: number;
			total: number;
		};
	};
}

export interface StrapiSingleResponse<T> {
	data: T;
}

export interface CreatePayload<T> {
	data: DeepPartial<T>;
}

export interface UpdatePayload<T> {
	data: DeepPartial<T>;
}
