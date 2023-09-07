[![npm](https://img.shields.io/npm/v/@egomobile/orm-mssql.svg)](https://www.npmjs.com/package/@egomobile/orm-mssql)
[![last build](https://img.shields.io/github/workflow/status/egomobile/node-orm-mssql/Publish)](https://github.com/egomobile/node-orm-mssql/actions?query=workflow%3APublish)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/egomobile/node-orm-mssql/pulls)

# @egomobile/orm-mssql

> A Microsoft SQL Server data adapter and other utilities for [@egomobile/orm](https://github.com/egomobile/node-orm) module.

## Install

Execute the following command from your project folder, where your `package.json` file is stored:

```bash
npm install --save @egomobile/orm-mssql
```

The following modules are defined in [peerDependencies](https://nodejs.org/uk/blog/npm/peer-dependencies/) and have to be installed manually:

- [@egomobile/orm](https://github.com/egomobile/node-orm)
- [mssql](https://github.com/tediousjs/node-mssql)

## Usage

```typescript
import { createDataContext } from "@egomobile/orm";
import { MSSQLDataAdapter } from "@egomobile/orm-mssql";
import type { IResult } from "mssql";

class User {
  // non-nullable fields
  public id: number = undefined!;
  public first_name: string = undefined!;
  public last_name: string = undefined!;

  // nullable fields
  public email: string | null = undefined!;
}

async function main() {
  const context = await createDataContext({
    adapter: new MSSQLDataAdapter(),
    entities: {
      // name of the entity / table
      users: {
        ids: ["id"], // list of column(s) which represent the ID
        type: User, // the class / type to use to create objects from
      },
    },
    noDbNull: true,
  });

  const listOfUsers: User[] = await context.find(User, {
    // WHERE clause
    where: "[is_active]=@_1 AND [is_deleted]=@_2",
    params: [true, false], // @_1, @_2

    offset: 1, // skip the first
    limit: 100, // only return 100 rows
  });

  // return a user with ID 5979
  const specificUser: User | null = await context.findOne(User, {
    where: "[id]=@_1",
    params: [5979], // @_1
  });

  if (specificUser !== null) {
    // update with new data
    specificUser.last_name = "Doe";
    specificUser.first_name = "Jane";
    specificUser.email = null;
    await context.update(specificUser);

    // remove from database
    await context.remove(specificUser);
  } else {
    console.log("User not found");
  }
}

// create new POCO
const newUser = new User();
newUser.first_name = "John";
newUser.last_name = "Doe";
// ... and add it to database
await context.insert(newUser);

// do raw queries
const result: IResult<any> = await context.query(
  "SELECT * FROM [users] WHERE [id]=@_1 AND [is_active]=@_2;",
  23979,
  true
);
console.log(result);

main().catch(console.error);
```

## Migrations

Before you can use migrations, first keep sure to have an existing `migrations` table in your database:

```sql
CREATE TABLE [dbo].[migrations] (
    [id]        BIGINT         IDENTITY (1, 1) NOT NULL,
    [timestamp] BIGINT         NOT NULL,
    [name]      NVARCHAR (MAX) NOT NULL,
    CONSTRAINT [PK_migrations] PRIMARY KEY CLUSTERED ([id] ASC)
);
```

A quick example how to use [MSSQLMigrationContext class](https://egomobile.github.io/node-orm-mssql/classes/MSSQLMigrationContext.html):

```typescript
import { MSSQLDataAdapter, MSSQLMigrationContext } from "@egomobile/orm-mssql";

async function main() {
  const context = new MSSQLMigrationContext({
    // a default adapter
    adapter: new MSSQLDataAdapter(),

    // scan for .js files
    // inside ./migration subfolder
    // with the following format:
    //
    // <UNIX-TIMESTAMP>-<NAME-OF-THE-MIGRATION>.js
    //
    // example: 1746942104690-CreateUserTable.js
    migrations: __dirname + "/migration",

    table: "migrations",
  });

  // UP-GRADE database
  await context.up();

  // DOWN-GRADE database
  await context.down();
}

main().catch(console.error);
```

A migration file looks like this:

```javascript
/**
 * Function to UP-GRADE the database.
 */
module.exports.up = async (context) => {
  // context => https://egomobile.github.io/node-orm/interfaces/IDataContext.html

  await context.query(`
CREATE TABLE [dbo].[tdta_user]
(
    [id] BIGINT IDENTITY (1, 1) NOT NULL,
    [email] NVARCHAR (MAX) NOT NULL
);
`);
};

/**
 * Function to DOWN-GRADE the database.
 */
module.exports.down = async (context) => {
  // context => https://egomobile.github.io/node-orm/interfaces/IDataContext.html

  await context.query(`DROP TABLE [dbo].[tdta_user];`);
};
```

You are also able to create a migration file programmatically:

```typescript
import { createNewMigrationFile } from "@egomobile/orm-mssql";

const newFilePath = await createNewMigrationFile("the name of the migration", {
  // create output file inside ./migrations sub folder
  dir: __dirname + "/migrations",

  // generate and add optional header and footer to the file
  header: ({ name, timestamp }) =>
    `// Hello, this is migration '${name}' created on ${timestamp}\n\n`,
  footer: "\n\n// Copyright (x) e.GO Mobile SE, Aachen, Germany\n\n",
});

console.log("Migration file has been created in", newFilePath);
```

## Documentation

The API documentation can be found [here](https://egomobile.github.io/node-orm-mssql/).
