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
import type { IDataContext } from "@egomobile/orm";
import type { Nilable } from "@egomobile/orm/lib/types/internal";
import type { MSSQLDataAdapter } from "../classes/MSSQLDataAdapter";

/**
 * A debug action.
 *
 * @param {string} message The message text.
 * @param {string} icon The icon.
 * @param {Nilable<string>} [source] The name of the optional source.
 */
export type DebugAction = (message: string, icon: DebugIcon, source?: Nilable<string>) => any;

/**
 * A possible value for a known debug icon.
 *
 * 🐞: debug
 * ✅: success
 * ℹ️: info
 * ❌: error
 * ⚠️: warning
 */
export type DebugIcon = "🐞" | "✅" | "ℹ️" | "❌" | "⚠️";

/**
 * A migration for a MSSQL database.
 */
export interface IMSSQLMigration {
    /**
     * The underlying module.
     */
    readonly module: IMSSQLMigrationModule;
    /**
     * The name.
     */
    name: string;
    /**
     * The UNIX timestamp in ms.
     */
    timestamp: number;
}

/**
 * A migration module.
 */
export interface IMSSQLMigrationModule {
    /**
     * The function to DOWNgrade a database.
     *
     * @param {MSSQLDataAdapter} adapter The underlying adapter.
     * @param {IDataContext} context The underlying database context.
     */
    down: MigrationAction;

    /**
     * The function to UPgrade a database.
     *
     * @param {MSSQLDataAdapter} adapter The underlying adapter.
     * @param {IDataContext} context The underlying database context.
     */
    up: MigrationAction;
}

/**
 * Information, which can be used to create a new migration file.
 */
export interface INewMigrationInfo {
    /**
     * The sanitized base (file-)name without extension.
     */
    filename: string;
    /**
     * The name.
     */
    name: string;
    /**
     * The timestamp.
     */
    timestamp: number;
}

/**
 * A migation action.
 *
 * @param {MSSQLDataAdapter} adapter The underlying adapter.
 * @param {IDataContext} context The underlying database context.
 * @param {DebugAction} debug The debug action.
 */
export type MigrationAction = (adapter: MSSQLDataAdapter, context: IDataContext, debug: DebugAction) => Promise<any>;

/**
 * An instance, which can be used as client.
 */
export type MSSQLClientLike = mssql.ConnectionPool;
