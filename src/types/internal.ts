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

import type { DebugIcon } from ".";

export type DebugActionWithoutSource = (message: string, icon: DebugIcon) => any;

export type Getter<T extends any = any> = () => T | Promise<T>;

export type ValueOrGetter<T extends any = any> = T | Getter<T>;
