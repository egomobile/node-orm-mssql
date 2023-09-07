/* eslint-disable unicorn/filename-case */

// This file is part of the @egomobile/orm-mssql distribution.
// Copyright (c) Next.e.GO Mobile SE, Aachen, Germany (https://e-go-mobile.com/)
//
// @egomobile/orm-mssql is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation, version 3.
//
// @egomobile/orm-mssql is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import mssql from "mssql";
import { DataAdapterBase, IFindOneOptions, IFindOptions, NULL, isExplicitNull } from "@egomobile/orm";
import type { Constructor, List, Nilable } from "@egomobile/orm/lib/types/internal";
import type { DebugAction, MSSQLClientLike } from "../types";
import type { DebugActionWithoutSource, Getter } from "../types/internal";
import { isMSSQLClientLike } from "../utils";
import { asList, isIterable, isNil, toDebugActionSafe } from "../utils/internal";

interface IBuildFindQueryOptions extends IMSSQLFindOptions {
    shouldNotWrapFields?: boolean;
}

/**
 * Options for 'find()' method of a 'MSSQLDataAdapter' instance.
 */
export interface IMSSQLFindOptions extends IMSSQLFindOneOptions, IFindOptions {
    /**
     * @inheritdoc
     */
    fields?: Nilable<string[]>;
    /**
     * @inheritdoc
     */
    params?: Nilable<any[]>;
    /**
     * Sort settings.
     */
    sort?: Nilable<Record<string, "ASC" | "DESC">>;
    /**
     * @inheritdoc
     */
    where?: Nilable<string>;
}

/**
 * Options for 'findOne()' method of a 'MSSQLDataAdapter' instance.
 */
export interface IMSSQLFindOneOptions extends IFindOneOptions {
    /**
     * @inheritdoc
     */
    fields?: Nilable<string[]>;
    /**
     * @inheritdoc
     */
    params?: Nilable<any[]>;
    /**
     * Sort settings.
     */
    sort?: Nilable<Record<string, "ASC" | "DESC">>;
    /**
     * @inheritdoc
     */
    where?: Nilable<string>;
}

/**
 * Options for instance of 'MSSQLDataAdapter' class.
 */
export interface IMSSQLDataAdapterOptions {
    /**
     * The underlying client or a function, which returns it.
     */
    client?: Nilable<MSSQLClientLike | Getter<MSSQLClientLike> | MSSQLClientConfig>;
    /**
     * The optional debug action / handler.
     */
    debug?: Nilable<DebugAction>;
}

interface IToClientGetterOptions {
    value: Nilable<MSSQLClientLike | Getter<MSSQLClientLike> | MSSQLClientConfig>;
}

interface ITransformValueOptions {
    direction: "from" | "to";
    field: string;
    type: Constructor<any>;
    value: any;
}

/**
 * A possible value for a mssql client/pool configuration.
 */
export type MSSQLClientConfig = mssql.config | mssql.ConnectionPool;

/**
 * A valid option value for 'MSSQLDataAdapter' class.
 */
export type MSSQLDataAdapterOptionsValue = IMSSQLDataAdapterOptions | MSSQLClientLike;

type SyncValueTransformer = (options: ITransformValueOptions) => any;

function transformValueUsingDbNull({ direction, value }: ITransformValueOptions): any {
    if (direction === "from") {
        return isNil(value) ? NULL : value;
    }
    else if (direction === "to") {
        return isExplicitNull(value) ? null : value;
    }
}

function transformValueUsingJSNull({ direction, value }: ITransformValueOptions): any {
    if (direction === "from") {
        return isNil(value) ? null : value;
    }
    else if (direction === "to") {
        return value === null || isExplicitNull(value) ? null : value;
    }
}

/**
 * A data adapter which is written for Microsoft SQL databases.
 */
export class MSSQLDataAdapter extends DataAdapterBase {
    private readonly clientGetter: Getter<MSSQLClientLike>;
    private readonly debug: DebugActionWithoutSource;

    /**
     * Initializes a new instance of that class.
     *
     * @param {Nilable<PostgreSQLDataAdapterOptionsValue>} [optionsOrClient] The options or the client/pool.
     */
    public constructor(optionsOrClient?: Nilable<MSSQLDataAdapterOptionsValue>) {
        super();

        let options: Nilable<IMSSQLDataAdapterOptions>;
        if (isMSSQLClientLike(optionsOrClient)) {
            options = {
                "client": optionsOrClient
            };
        }
        else {
            options = optionsOrClient;
        }

        if (!isNil(options)) {
            if (typeof options !== "object") {
                throw new TypeError("optionsOrClient is invalid");
            }
        }

        this.clientGetter = toClientGetter({
            "value": options?.client
        });
        this.debug = toDebugActionSafe("MSSQLDataAdapter", options?.debug);
    }

    private buildFindQuery<T extends any = any>(
        type: Constructor<T>,
        findOptions: IBuildFindQueryOptions | null | undefined
    ) {
        const table = this.getEntityNameByTypeOrThrow(type);

        const shouldNotWrapFields = !!findOptions?.shouldNotWrapFields;

        const fields = findOptions?.fields;
        if (!isNil(fields)) {
            if (!Array.isArray(fields)) {
                throw new TypeError("findOptions.fields must be an array");
            }
        }

        const params = findOptions?.params;
        if (!isNil(params)) {
            if (!Array.isArray(params)) {
                throw new TypeError("findOptions.params must be an array");
            }
        }

        const sort = findOptions?.sort;
        if (!isNil(sort)) {
            if (typeof sort !== "object") {
                throw new TypeError("findOptions.sort must be an object");
            }
        }

        const where = findOptions?.where;
        if (!isNil(where)) {
            if (typeof where !== "string") {
                throw new TypeError("findOptions.where must be a string");
            }
        }

        const limit = findOptions?.limit;
        if (!isNil(limit)) {
            if (typeof limit !== "number") {
                throw new TypeError("findOptions.limit must be a number");
            }
        }

        const offset = findOptions?.offset;
        if (!isNil(offset)) {
            if (typeof offset !== "number") {
                throw new TypeError("findOptions.offset must be a number");
            }
        }

        const projection = fields?.length ?
            fields.map(f => {
                return shouldNotWrapFields ? `${f}` : `[${f}]`;
            }).join(",") :
            "*";

        let topPrefix = "";
        if (!isNil(limit)) {
            topPrefix = `TOP ${limit} `;
        }

        // build query
        let q = `SELECT ${topPrefix}${projection} FROM ${table}`;
        if (where?.length) {
            q += ` WHERE (${where})`;
        }
        if (sort) {
            q += ` ORDER BY ${Object.entries(sort)
                .map((entry) => {
                    return `[${entry[0]}] ${entry[1]}`;
                })
                .join(",")}`;
        }
        if (!isNil(offset)) {
            q += ` OFFSET ${offset} ROWS`;
        }
        q += ";";

        return {
            "query": q,
            "params": params ?? []
        };
    }

    /**
     * @inheritdoc
     */
    async count<T extends unknown = any>(type: Constructor<T>, options?: Nilable<IFindOptions>): Promise<number> {
        const {
            params,
            query
        } = this.buildFindQuery(type, {
            ...(options || {}),

            "shouldNotWrapFields": true,
            "fields": [
                "COUNT(*) AS c"
            ]
        });

        const {
            recordsets
        } = await this.query(query, ...params);

        return Number((recordsets as mssql.IRecordSet<any>)[0][0].c);
    }

    private get defaultValueTransformer(): SyncValueTransformer {
        if (this.context.noDbNull) {
            return transformValueUsingJSNull;
        }

        return transformValueUsingDbNull;
    }

    /**
     * @inheritdoc
     */
    find<T extends unknown = any>(type: Constructor<T>, options?: Nilable<IFindOptions>): Promise<T[]> {
        const {
            params,
            query
        } = this.buildFindQuery(type, options);

        return this.queryAndMap(type, query, ...params);
    }

    /**
     * @inheritdoc
     */
    async findOne<T extends unknown = any>(type: Constructor<T>, options?: Nilable<IFindOneOptions>): Promise<T | null> {
        const entities = await this.find(type, {
            ...(options || {}),
            "limit": 1
        });

        return entities[0] || null;
    }

    /**
     * Gets the underlying client / pool.
     *
     * @returns {Promise<MSSQLClientLike>} The promise with the client.
     */
    public getClient(): Promise<MSSQLClientLike> {
        return Promise.resolve(this.clientGetter());
    }

    private hasColumnValue(entity: any, columnName: PropertyKey): boolean {
        if (this.context.noDbNull) {
            return typeof entity[columnName] !== "undefined";
        }

        return !isNil(entity[columnName]);
    }

    /**
     * @inheritdoc
     */
    async insert<T extends unknown = any>(entityOrEntities: T | List<T>): Promise<T | T[]> {
        if (isNil(entityOrEntities)) {
            throw new TypeError("entityOrEntities cannot be (null) or (undefined)");
        }

        const isSingleEntity = !isIterable(entityOrEntities);
        const entities = asList(entityOrEntities)!;

        const result: T[] = [];

        for (const entity of entities) {
            const type: Constructor = (entity as any).constructor;
            const table = this.getEntityNameByTypeOrThrow(type);
            const idCols = this.getEntityIdsByType(type);
            const valueCols = Object.keys(entity as any).filter(
                (columnName) => {
                    return this.hasColumnValue(entity, columnName);
                },
            );

            const values: any[] = [];
            for (const field of valueCols) {
                const value = (entity as any)[field];

                values.push(
                    await this.transformValue({
                        "direction": "to",
                        field,
                        type,
                        value
                    })
                );
            }

            const columnList = valueCols.map((c) => {
                return `"${c}"`;
            }).join(",");
            const valueList = valueCols.map((c, i) => {
                return `@_${i + 1}`;
            }).join(",");

            let lastInsertStatment = "";
            if (idCols.length) {
                lastInsertStatment = " SELECT SCOPE_IDENTITY() AS i;";
            }

            const queryResult = await this.query(
                `INSERT INTO ${table} (${columnList}) VALUES (${valueList});${lastInsertStatment}`,
                ...values,
            );

            if (idCols.length) {
                const recordsets = queryResult.recordsets as mssql.IRecordSet<any>[];

                const row: Record<string, any> = recordsets[1][0];

                // WHERE clause for getting new, inserted entity
                const whereInserted = Object.keys(row)
                    .map((columnName, index) => {
                        return `[${columnName}]=@_${index + 1}`;
                    })
                    .join(" AND ");
                const params = Object.values(row);

                // get new row as entity with new and updated data
                result.push(
                    await this.findOne(type, {
                        "where": whereInserted,
                        params
                    })
                );
            }
            else {
                // no ID column(s), so return simple entity
                result.push(entity);
            }
        }

        return isSingleEntity ? result[0] : result;
    }

    private async mapEntityWithRow(entity: any, row: Record<string, any>) {
        const type: Constructor = (entity as any).constructor;

        for (const [field, value] of Object.entries(row)) {
            if (typeof value === "function") {
                continue;  // ignore methods
            }

            if (field in entity) {
                // only if column is prop of entity

                entity[field] = await this.transformValue({
                    "direction": "from",
                    field,
                    type,
                    value
                });
            }
        }
    }

    /**
     * Invokes a raw SQL query.
     *
     * @param {string} sql The SQL query,
     * @param {any[]} [values] One or more values for the placeholders in the SQL query.
     *
     * @returns {Promise<mssql.IResult<any>>} The promise with the result.
     */
    async query(sql: string, ...values: any[]): Promise<mssql.IResult<any>> {
        this.debug(`SQL QUERY: ${sql}`, "🐞");

        const client = await this.getClient();

        const request = client.request();

        for (let i = 0; i < values.length; i++) {
            const paramName = `_${i + 1}`;
            const value = values[i];

            request.input(paramName, value);
        }

        return request.query(sql);
    }

    /**
     * @inheritdoc
     */
    async queryAndMap<T extends unknown = any>(type: Constructor<any>, sql: string, ...values: any[]): Promise<any[]> {
        this.debug(`SQL QUERY AND MAP: ${sql}`, "🐞");

        const sqlResult = await this.query(sql, ...values);

        const recordsets = (Array.isArray(sqlResult.recordsets) ?
            sqlResult.recordsets :
            [sqlResult.recordsets]) as mssql.IRecordSet<any>[];

        const entities: T[] = [];

        for (let i = 0; i < recordsets.length; i++) {
            const recordset = recordsets[i];

            for (let j = 0; j < recordset.length; j++) {
                const row = recordset[j];

                const newEntity = new type();
                await this.mapEntityWithRow(newEntity, row);

                entities.push(newEntity);
            }
        }

        return entities;
    }

    /**
     * @inheritdoc
     */
    async remove<T extends unknown = any>(entityOrEntities: T | List<T>): Promise<T | T[]> {
        if (isNil(entityOrEntities)) {
            throw new TypeError("entityOrEntities cannot be (null) or (undefined)");
        }

        const isSingleEntity = !isIterable(entityOrEntities);
        const entities = asList(entityOrEntities)!;

        const result: T[] = [];

        for (const entity of entities) {
            const type: Constructor = (entity as any).constructor;
            const table = this.getEntityNameByTypeOrThrow(type);
            const idCols = this.getEntityIdsByTypeOrThrow(type);

            // collect ID values
            const idValues: any[] = [];
            for (const field of idCols) {
                const value = (entity as any)[field];

                idValues.push(
                    await this.transformValue({
                        "direction": "to",
                        field,
                        type,
                        value
                    })
                );
            }

            let i = 0;

            // WHERE clause
            const where = idCols
                .map((columnName) => {
                    return `[${columnName}]=@_${++i}`;
                })
                .join(" AND ");

            // build and run query
            await this.query(
                `DELETE FROM ${table} WHERE (${where});`,
                ...idValues,
            );

            // simply return entity
            result.push(entity);
        }

        return isSingleEntity ? result[0] : result;
    }

    private async transformValue(options: ITransformValueOptions): Promise<any> {
        const { direction, field, type, value } = options;

        const entity = this.getEntityByType(type);

        if (entity) {
            const transformer = entity.config?.fields?.[field]?.transformer?.[direction];
            if (transformer) {
                return Promise.resolve(transformer(value));
            }
        }

        return this.defaultValueTransformer(options);
    }

    /**
     * @inheritdoc
     */
    async update<T extends unknown = any>(entityOrEntities: T | List<T>): Promise<T | T[]> {
        if (isNil(entityOrEntities)) {
            throw new TypeError("entityOrEntities cannot be (null) or (undefined)");
        }

        const isSingleEntity = !isIterable(entityOrEntities);
        const entities = asList(entityOrEntities)!;

        const result: T[] = [];

        for (const entity of entities) {
            const type: Constructor = (entity as any).constructor;
            const table = this.getEntityNameByTypeOrThrow(type);
            const idCols = this.getEntityIdsByTypeOrThrow(type);
            const valueCols = Object.keys(entity as any).filter(
                (columnName) => {
                    return !idCols.includes(columnName) &&
                        this.hasColumnValue(entity, columnName);
                },
            );

            if (!valueCols.length) {
                continue;  // nothing to do
            }

            const addValuesTo = async (fields: string[], vals: any[]) => {
                for (const field of fields) {
                    const value = (entity as any)[field];

                    vals.push(
                        await this.transformValue({
                            "direction": "to",
                            field,
                            type,
                            value
                        })
                    );
                }
            };

            let i = 0;

            // values to update
            const values: any[] = [];
            await addValuesTo(valueCols, values);
            const set = valueCols
                .map((columnName) => {
                    return `[${columnName}]=@_${++i}`;
                })
                .join(",");

            // WHERE clause
            const idValues: any[] = [];
            await addValuesTo(idCols, idValues);
            const where = idCols
                .map((columnName) => {
                    return `[${columnName}]=@_${++i}`;
                })
                .join(" AND ");

            // now build and run query
            await this.query(
                `UPDATE ${table} SET ${set} WHERE (${where});`,
                ...[...values, ...idValues],
            );

            // WHERE clause for getting updated entity
            const whereUpdated = idCols
                .map((columnName, index) => {
                    return `[${columnName}]=@_${index + 1}`;
                })
                .join(" AND ");

            // get updated entity
            result.push(
                await this.findOne(type, {
                    "where": whereUpdated,
                    "params": idValues
                })
            );
        }

        return isSingleEntity ? result[0] : result;
    }
}

function toClientGetter(
    { value }: IToClientGetterOptions
): Getter<MSSQLClientLike> {
    if (typeof value === "function") {
        return value;
    }
    else if (isMSSQLClientLike(value)) {
        return async () => {
            return value;
        };
    }
    else if (typeof value === "object" || typeof value === "string") {
        const pool = new mssql.ConnectionPool(value as any);

        return async () => {
            if (!pool.connected) {
                await pool.connect();
            }

            return pool;
        };
    }

    throw new TypeError("value cannot be used as client or pool");
}