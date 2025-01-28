# Make the Script Executable

On Unix-based systems (Linux/macOS), you need to set the script file as executable:
`
chmod +x sleep-debt-cli.mjs
`

# Install the CLI globally 

`npm install -g`

# Using the CLI Command
Once installed globally, you can run the program with the command defined in the "bin" field:
`sleep-debt`


# Summary of Cross-OS Compatibility
- Linux/macOS: Shebang (#!/usr/bin/env node) and chmod +x.
- Windows: The node interpreter handles script execution automatically.
- Global Install: Use npm install -g for system-wide access.