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

export interface IWithMSSQLConnection {
    client: ValueOrGetter<Nilable<MSSQLConfigValue>>;
    entities: ValueOrGetter<EntityConfigurations>;
    noDbNull?: Nilable<boolean>;
}

export interface IWithMSSQLOptions {
    withTransaction?: Nilable<boolean>;
}

export type MSSQLConfigValue = string | mssql.config;

export type WithMSSQLConnections = {
    "default": IWithMSSQLConnection;

    [connectionName: string]: IWithMSSQLConnection;
};

export type WithMSSQLAction<TResult extends any = any> = (
    context: IDataContext,
) => Promise<TResult>;

export type WithPostgresFunction<T extends WithMSSQLConnections = WithMSSQLConnections> =
    <TResult extends any = any>(
        connection: keyof T,
        action: WithMSSQLAction<TResult>,
        options?: Nilable<IWithMSSQLOptions>
    ) => Promise<TResult>;

export function createWithMSSQL<TConnections extends WithMSSQLConnections = WithMSSQLConnections>(
    connections: TConnections
): WithPostgresFunction<TConnections> {
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
            "server": "Server=127.0.0.1;"
        };

        const connection = await mssql.connect(config);

        try {
            const context = await createDataContext({
                "adapter": new MSSQLDataAdapter(connection) as IDataAdapter,
                "entities": await getEntityConfigurations(),
                "noDbNull": true
            });

            const result = await action(context);

            return result;
        }
        finally {
            await connection.close();
        }
    };
}
