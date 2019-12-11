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
var fs = require("fs");

// Shortcut for the ApiError Constructor
ApiError = OCAEngine.ApiError;

// Get some input arguments
var cmd = process.argv[2];
var user = process.argv[3];
var secret = process.argv[4];
var email = process.argv[5];

// Initializes the Security Module
if (lib.sec.init(OCAcnf.seeds) != true) {
  banner();
  throw new ApiError("Cannot Initialize the Security Module, Aborting!");
}

// Parses the first argument (cmd)
if (cmd == null || (cmd != "t" && user == null)) {
  banner();
  console.log("  ERROR: cmd and data are required");
  usage();
  return 1;
}

// Executes the different commands
if (cmd == "add") {
  addUser(user, secret, email);
} else if (cmd == "mod") {
  modUser(user, secret, email);
} else if (cmd == "del") {
  console.log("HMAC (NEW) = " + lib.sec.hmac(data, algor));
} else if (cmd == "check") {
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
  console.log("\n  USAGE: users.js <cmd = add,mod,del,check> <username> [ password ]\n");
}

function banner() {
  console.log("\nOpenCA Users Tool - v0.1\n"+
              "(c) 2019 by Massimiliano Pala and OpenCA Labs\n" +
              "All Rights Reserved\n\n");
}

function addUser( userId, userSecret, email ) {

  // Input check
  if (!userId || !userSecret || !email) {
    throw new ApiError(
      "ERROR: userId (" + userId +
      "), userSecret (" + typeof(userSecret) + 
      "), and email (" + email + 
      ") are needed!");
  }

  // Local Template for the User
  var userTemplate = { 
	id: null,
        passwd: null,
        email: null,
        phone: null,
        address: {
          street1 : null,
          street2 : null,
          city : null,
          state : null,
          country : null,
          zip : null
        }};

  // The User Instance
  var newUser = userTemplate;

  // Adds the user-specific data
  newUser.id = userId;
  newUser.email = email;
  newUser.passwd = lib.sec.hmac(userSecret);

  // Sanitize the username
  newUser.id = newUser.id.replace(/[.!/$]+/gi, "");

  // Filename of the User's Profile
  var outName = "conf/users/" + newUser.id + ".json";

  try {
    // Checks if the user already exists
    if (fs.existsSync( outName )) {
      console.log("User ID (" + newUser.id + ") already exists, aborting.");
      return 0;
    }

    // Saves the data into the target user file
    fs.writeFile(outName, JSON.stringify(newUser), function (err) {
      if (err) {
        console.log("ERROR: Cannot add new user (" + newUser.id + ") - Code: " + err);
      } else {
        console.log("User (" + newUser.id + ") created successfully [Path: " + outName + "]");
      }
    });
    
  } catch (e) {
 
    // Unspecified Error
    console.log("ERROR: Cannot add new user (" + outName + ") - Code: " + e);

  }

  // All Done
  return 1;
}

function modUser( userId, field, data ) {

  // Input check
  if (!userId) {
    throw new ApiError(
      "ERROR: userId (" + userId +
      "), userSecret (" + typeof(userSecret) + 
      "), and email (" + email + 
      ") are needed!");
  }
 
  // Filename of the User's Profile
  var fileName = "conf/users/" + newUser.id + ".json";

  // Sanitize the username
  userId = OCAtools.sanitizeUserId(userId);

  try {

    // Checks if the user already exists
    if (fs.existsSync( fileName )) {

      // Loads the File
      var newUser = JSON.parse(fs.readFileSync(inName, 'fileName', function(err, data) {
        throw new ApiError("ERROR: Cannot load user (" + userId + ")", err);
      }));

      // Adds the mod data
      switch (field) {
        case "email" : {
          newUser.email = data;
        } break;

        case "password" : {
          newUser.passwd = OCAsec.hmac(data);
        } break;

        case "street1" : {
          newUser.address.street1 = data;
        } break;

        case "street2" : {
          newUser.address.street2 = data;
        } break;

        case "city" : {
          newUser.address.city = data;
        } break;

        case "state" : {
          newUser.address.state = data;
        } break;

        case "country" : {
          newUser.address.country = data;
        } break;

        case "zip" : {
          newUser.address.zip = data;
        } break;

        case "address" : {
          var dataObj = JSON.parse(data);

          if (data.street1) newUser.street1 = data.street1;
          if (data.street2) newUser.street2 = data.street2;
          if (data.city) newUser.city = data.city;
          if (data.state) newUser.state = data.state;
          if (data.country) newUser.country = data.country;
          if (data.zip) newUser.zip = data.zip;

        } break;

        default: {
          throw new ApiError("Field " + field + " not supported.");
        }
      }
      if (userSecret) newUser.passwd = OCAsec.hmac(userSecret);
      if (email) newUser.email = email;

      // Saves the data into the target user file
      fs.writeFile(fileName, JSON.stringify(newUser), function (err) {
        if (err) {
          console.log("ERROR: Cannot update the user (" + newUser.id + ") - Code: " + err);
        } else {
          console.log("User (" + newUser.id + ") updated successfully [Path: " + outName + "]");
        }
      });

    }
  } catch (e) {
    // Unspecified Error
    console.log("ERROR: Cannot add new user (" + outName + ") - Code: " + e);
  }

  // All Done
  return 1;
}
