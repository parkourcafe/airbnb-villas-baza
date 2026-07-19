#!/usr/bin/env node
import { runCli } from "./cli";

/**
 * Local collector CLI entry point. This process runs on the OPERATOR'S machine,
 * not on a server: it drives a visible browser and stops for manual
 * intervention. See `runCli` for the command surface.
 */
runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
