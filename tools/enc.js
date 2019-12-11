#! /usr/bin/env node
// -*- js -*-
// "use strict";

// encrypt.js
//
// BASE SETUP
// =============================================================================

// Loads Conf and Engine
var OCAcnf = require("../conf/easypki_cnf");
var OCAEngine = require("../data/pub/js/OCAEngine.js")

// Loads the 'lib' modules
var lib = require("require-dir")( __dirname + "/../lib", { recurse: true });

// Shortcut for the ApiError Constructor
ApiError = OCAEngine.ApiError;

// Get some input arguments
var cmd = process.argv[2];
var data = process.argv[3];
var algor = process.argv[4];
var seed = process.argv[5];

// Initializes the Security Module
if (lib.sec.init(OCAcnf.seeds) != true) {
  banner();
  throw new ApiError("Cannot Initialize the Security Module, Aborting!");
}

// Parses the first argument (cmd)
if (cmd == null || (cmd != "t" && data == null)) {
  banner();
  console.log("  ERROR: cmd and data are required");
  usage();
  return 1;
}

// Executes the different commands
if (cmd == "e") {
  console.log(lib.sec.encrypt(data, algor));
} else if (cmd == "d") {
  console.log(lib.sec.decrypt(data));
} else if (cmd == "h") {
  console.log("HMAC (NEW) = " + lib.sec.hmac(data, algor));
} else if (cmd == "v") {
  if (algor == null) throw new ApiError("Missing hmacValue to verify!");
  console.log("HMAC (VERIFY) = " + lib.sec.verifyHmac(data, algor, seed));
} else if (cmd == "t") {
  lib.sec.tests();
} else {
  throw "  ERROR: cmd '" + cmd + "' not supported!\n\n";
}

// All Done
return 0;

function usage() {
  console.log(
    "\n  USAGE: enc.js <cmd = e,d> <data> [ algor = 0..3 ]\n" +
    "         enc.js <cmd = h,v> <data> <pwd> [ salt ]\n"   +
    "         enc.js <cmd = t>\n\n");
}

function banner() {
  console.log("\nOpenCA Security Tool - v0.1\n"+
              "(c) 2019 by Massimiliano Pala and OpenCA Labs\n" +
              "All Rights Reserved\n\n");
}
