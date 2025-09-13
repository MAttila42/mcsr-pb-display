# MCSR PB Display Extension

Browser extension to have your Minecraft Speedrun PB displayed next to your name on Twitch.

## Contributing

### Tech Stack

This app is made with

- [Bun](https://bun.sh/)
- [Svelte](https://svelte.dev/)
- [Shadcn](https://shadcn-svelte.com/)
- [UnoCSS](https://unocss.dev/)
- [Elysia](https://elysiajs.com/)
- [Drizzle](https://orm.drizzle.team/)

See documentation for each to get started.

### Prerequisites

- [Bun](https://bun.sh/docs/installation)
- [VSCode](https://code.visualstudio.com/) (recommended)
- You should also install all recommended VSCode extensions from the `.vscode/extensions.json` file.

### Setup

Example commands use [@antfu/ni](https://github.com/antfu-collective/ni).

```sh
ni # Install dependencies
nlx eemoji init -c none # Initialize automatic commit emojis

nr setup:db # Setup the database (use in the `api` package)
```

### Commands

This project is a monorepo with two packages:

- `extension`: The Svelte browser extension
- `api`: The Elysia backend API

Some commands require you to be in the correct package directory. Check the `package.json` files for the scripts.

#### Development

You can use these commands in either of the packages.

```sh
nr dev
nr build
```

#### Database

For use in the `api` package.

```sh
nr db # drizzle-kit alias, use any subcommands available

# Examples
nr db generate # Generate SQL migrations
nr db migrate # Apply migrations
nr db push # Push schema changes without SQL file generations
nr db studio # Start real time SQL explorer
```

For more information, check the [documentation](https://orm.drizzle.team/docs/kit-overview).

#### Other

```sh
nr add <component> # Add shadcn component (`extension` package only)
nr lint # Eslint check and fix
nr update # Update all dependencies to the latest version
```
