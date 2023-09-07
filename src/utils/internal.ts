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

import type { List, Nilable } from "@egomobile/orm/lib/types/internal";
import type { DebugAction, IMSSQLMigration } from "../types";
import type { DebugActionWithoutSource } from "../types/internal";

export function asList<T extends any = any>(
    itemOrList: Nilable<T | List<T>>,
): Nilable<List<T>> {
    if (isNil(itemOrList)) {
        return itemOrList as Nilable<List<T>>;
    }

    if (isIterable(itemOrList)) {
        return itemOrList as List<T>;
    }

    return [itemOrList];
}

export function isIterable(obj: any): obj is List<any> {
    if (obj) {
        return typeof obj[Symbol.iterator] === "function";
    }

    return false;
}

export function isNil(val: unknown): val is (null | undefined) {
    return typeof val === "undefined" || val === null;
}

export function setupMigrationModuleProp(
    migration: IMSSQLMigration, fullPath: string
) {
    // IMSSQLMigration.module
    Object.defineProperty(migration, "module", {
        "enumerable": true,
        "get": () => {
            return require(fullPath);
        }
    });
}

export function toDebugActionSafe(source: string, debug: Nilable<DebugAction>): DebugActionWithoutSource {
    if (isNil(debug)) {
        return () => { };
    }

    if (typeof debug !== "function") {
        throw new TypeError("debug must be of type function");
    }

    return (message, icon) => {
        return debug(message, icon, source);
    };
}
