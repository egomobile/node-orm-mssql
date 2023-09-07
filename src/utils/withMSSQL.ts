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
import { EntityConfigurations, IDataAdapter, IDataContext, createDataContext } from "@egomobile/orm";
import type { Nilable } from "@egomobile/orm/lib/types/internal";
import type { ValueOrGetter } from "../types/internal";
import { MSSQLDataAdapter } from "../classes";

/**
 * An entry in an `WithMSSQLConnections` object.
 */
export interface IWithMSSQLConnection {
    /**
     * The client configuration for `mssql` module or the function, which returns it.
     */
    client: ValueOrGetter<Nilable<MSSQLConfigValue>>;
    /**
     * The list of entity configurations or the function, which returns it.
     */
    entities: ValueOrGetter<EntityConfigurations>;
    /**
     * Indicates that the special value `NULL` should not be used
     * for this entity by default.
     */
    noDbNull?: Nilable<boolean>;
}

/**
 * Options for a 'withMSSQL()' function.
 */
export interface IWithMSSQLOptions {
    /**
     * Run action in transaction or not.
     */
    withTransaction?: Nilable<boolean>;
}

export type MSSQLConfigValue = string | mssql.config;

/**
 * An action for a `WithMSSQLFunction`.
 *
 * @param {IDataContext} context The underlying data context.
 *
 * @returns {Promise<TResult>} The promise with the result.
 */
export type WithMSSQLConnections = {
    /**
     * The required default connection.
     */
    "default": IWithMSSQLConnection;

    /**
     * One or more additional, known connections.
     */
    [connectionName: string]: IWithMSSQLConnection;
};

/**
 * An action for a `WithMSSQLFunction`.
 *
 * @param {IDataContext} context The underlying data context.
 *
 * @returns {Promise<TResult>} The promise with the result.
 */
export type WithMSSQLAction<TResult extends any = any> = (
    context: IDataContext,
) => Promise<TResult>;

/**
 * A 'withMSSQL()' function.
 *
 * @param {keyof T} connection The name of the known connection.
 * @param {WithMSSQLAction<TResult>} action The action to invoke.
 * @param {Nilable<IWithMSSQLOptions>} [options] Additional and custom options.
 *
 * @returns {Promise<TResult>} The promise with the result of the action.
 */
export type WithMSSQLFunction<T extends WithMSSQLConnections = WithMSSQLConnections> =
    <TResult extends any = any>(
        connection: keyof T,
        action: WithMSSQLAction<TResult>,
        options?: Nilable<IWithMSSQLOptions>
    ) => Promise<TResult>;

/**
 * Creates a function, which runs itself an action inside an open MSSQL connection.
 *
 * @param {TConnections} connections The list of known connections to registers.
 *
 * @example
 * ```
 * import { createWithMSSQL } from "@egomobile/orm-mssql"
 *
 * // `EntityConfigurations` objects, returned by functions
 * // exported as `default`s
 * import getDefaultEntityConfiguration from './entities/default'
 * import getTestEntityConfiguration from './entities/test'
 *
 *
 * const withMSSQL = createWithMSSQL({
 *   "default": {
 *     "client": null,  // read `mssql` config from environment variables
 *     "entities": getDefaultEntityConfiguration()
 *   },
 *
 *   "test1": {
 *     "client": 'Server=127.0.0.1;TrustServerCertificate=True;User Id=sa;Password=Abcd1234!#',
 *     "entities": getTestEntityConfiguration()
 *   }
 * })
 *
 *
 * // `defaultResult` === "FOO"
 * const defaultResult = await withMSSQL('default', async (defaultContext) => {
 *   // do something with `default` connection in `defaultContext`
 *
 *   return "FOO"
 * })
 *
 * // `test1Result` === "bar"
 * const test1Result = await withMSSQL('test1', async (test1Context) => {
 *   // do something with `test1` connection in `test1Context`
 *
 *   return "bar"
 * })
 * ```
 *
 * @returns {WithMSSQLFunction<TConnections>} The new function.
 */
export function createWithMSSQL<TConnections extends WithMSSQLConnections = WithMSSQLConnections>(
    connections: TConnections
): WithMSSQLFunction<TConnections> {
    return async (connectionName, action, options?) => {
        const knownConnection = connections[connectionName];

        if (!knownConnection) {
            throw new Error(`Connection ${connectionName as string} is unknown`);
        }

        const {
            "client": clientOrGetter,
            "entities": entityOrProvider
        } = knownConnection;

        let getClientConfig: () => Promise<Nilable<string | mssql.config>>;
        if (typeof clientOrGetter === "function") {
            getClientConfig = () => {
                return Promise.resolve(clientOrGetter());
            };
        }
        else {
            getClientConfig = async () => {
                return clientOrGetter as mssql.config;
            };
        }

        let getEntityConfigurations: () => Promise<EntityConfigurations>;
        if (typeof entityOrProvider === "function") {
            getEntityConfigurations = () => {
                return Promise.resolve(entityOrProvider());
            };
        }
        else {
            getEntityConfigurations = async () => {
                return entityOrProvider;
            };
        }

        const config: (string | mssql.config) = (await getClientConfig()) || {
            "server": "Server=127.0.0.1;TrustServerCertificate=True;User Id=sa"
        };

        const connection = await mssql.connect(config);

        let transaction: mssql.Transaction | undefined;
        if (!!options?.withTransaction) {
            transaction = connection.transaction();

            await transaction.begin();
        }

        try {
            const context = await createDataContext({
                "adapter": new MSSQLDataAdapter(connection) as IDataAdapter,
                "entities": await getEntityConfigurations(),
                "noDbNull": knownConnection.noDbNull
            });

            const result = await action(context);

            if (transaction) {
                await transaction.commit();
            }

            return result;
        }
        catch (ex) {
            if (transaction) {
                await transaction.rollback();
            }

            throw ex;
        }
        finally {
            await connection.close();
        }
    };
}
