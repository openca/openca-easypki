#! /usr/bin/env node
// -*- js -*-
// "use strict";
//
// testpki.js
// 
// BASE SETUP
// =============================================================================

// Command Line Version
VERSION = "0.1.0";

// Context
var ctx = {};

// NPM Requires
var req = require("request");

// General Vars
var host = "http://localhost:2001/1.0";

var reqOptions = {
  "recurse" : true,
  "extensions" : [ '.js', '.json' ],
  "filter" : function (path) {
  	return (path.match(/._.*/) ? false : true); }
  };

// Loads Modules
var pub = require("require-dir")( __dirname + "/../data/pub/js", reqOptions);
var usr = require("require-dir")( __dirname + "/../data/user/js", reqOptions);
var lib = require("require-dir")( __dirname + "/../lib", reqOptions);

// Exports Main Objects
OCAEngine = pub.OCAEngine;
OCAMsg    =     OCAEngine.OCAMsg;
OCAErr    =     OCAEngine.OCAErr;
ApiError  =     OCAEngine.ApiError;

// Arguments
var prg = require('commander');

// Some Information
banner();

// Let's Parse the arguments
prg.version(VERSION)
   .option('-a, --action <action>', 'Command (one of "add", "del", "mod", "list")')
   .option('-o, --org <organization>', 'Target Organization')
   .option('-t, --target <target>', 'Target to operate on (i.e., "org", "pki", "ca", "user", "job")')
   .option('-u, --username <username>', 'Login with the specified username')
   .option('-p, --password [password]', 'Password for logging into the system')
   .option('-k, --token [accessToken]', 'Access Token')
   .option('-K, --toKen-file [filename]', 'Access Token Filename (def. "~/.pkitoken")')
   .parse(process.argv);

// Let's check if we need to login or not
if (typeof prg.token === undefined && typeof prg.tokenFile === undefined) {
  // Here we do not have a valid token, therefore we need
  // to login into the application to retrieve one
  login(prg)
    .then(function OCA$processRequest () {
      console.log("ProcessRequest");
    })
    .then(function OCA$logOut() {
      console.log("LogOut");
    })
    // .catch(err) {
    //   console.log("ERR: " + err);
    // }
}

switch (prg.target) {

  case "usr" : {

    // Debugging
    console.log("target '%s' selected.", prg.target);

    switch(prg.action) {

      case "login" : {

        console.log("org '%s' selected", prg.org);
        console.log("action '%s' selected", prg.action);
        console.log("using '%s':'%s' as credentials.", prg.username, prg.password);

        if (prg.username == null || prg.password == null) {
          throw new Error("Missing username ('%s') and/or password ('%s')", prg.username, prg.password);
        }

        var data = {
          "uid" : prg.username,
          "creds" : {
            "type" : "password",
            "value" : prg.password
          }
        };

        // Where to send the JSON
        var path = host + "/u/login/" + prg.org;

        // OCAQuery("post", path, { json: data }, (err, res, body) => {
        OCAQuery("post", path, { json: data }, (msg, err, res) => {
          console.dir(msg, 4, true);
        });

      } break;

      case "logout" : {

        console.log("action '%s' selected", prg.action);

        var path = host + "/u/logout";

        // request.post( path, { json: { } }, (err, res, body) => {
        OCAQuery( "get", path, { }, (msg, err, res) => {

          if (!msg) {
            console.log("ERROR: Cannot logout");
            console.error(err);
            return;
          }

          // DEBUG
          console.dir(msg, 4, true);
        });

      } break;

      case "get" : {
        console.log("action '%s' selected", prg.action);
      } break;

      case "add" : {
        console.log("action '%s' selected", prg.action);
      } break;

      case "del" : {
        console.log("action '%s' selected", prg.action);
      } break;

      case "mod" : {
        console.log("action '%s' selected", prg.action);
      } break;

      default: {
        throw new ApiError("ERROR: option '%s' not supported for $(prg.target) (must be one of 'login', 'logout', 'get', 'add', 'del', 'mod')", option);
      }
    }

  } break;

  // ORG Management
  case "org": {

    // Debugging
    console.log("target '%s' prg.action selected.", prg.target);

    switch(prg.action) {

      case "get" : {
        console.log("action '%s' selected", prg.action);
        var orgId = process.argv[4];
        var path = host + "/api/org/" + orgId;

        OCAQuery("get", path, null, (msg, err, res) => {

          // Error Checking
          if (!msg || msg.err() || err) {
            console.log("ERROR: Cannot get info about ('%s')", orgId);
            console.error(err);
            return;
          }

          // Shortcut to the Organization Object
          var org = msg.body();

          // Prints out the info for the Organization
          console.log("\n[ %s ('%s') Details ]", org.name + " - " + org.id);
	  console.dir(org)
          console.log("");
        });

      } break;

      case "add" : {
        console.log("action '%s' selected", prg.action);
      } break;

      case "del" : {
        console.log("action '%s' selected", prg.action);
      } break;

      case "mod" : {
        console.log("action '%s' selected", prg.action);
      } break;

      case "list" : {
        console.log("action '%s' selected", prg.action);

        var path = host + "/api/org";

        OCAQuery("get", path, null, (msg, err, res) => {

          // Checks for some error
          if (!msg || err) {
            console.log("ERROR: Cannot get the list of organizatios.");
            console.error(err);
            return;
          }

          // Shortcut to the Array of Organizations Objects
          var orgList = msg.body();
          var idx = 1;

          // Prints out the list
          console.log("\nList of Enabled Organizations:");
          console.log("==============================\n");
          for (i in orgList) {
            var org = orgList[i];
            if (typeof(org) !== "object") continue;
            console.log("[%d] %s [ id: %s ]\n    %s", 
              idx++, org.name, org.id, org.description);
          }
          console.log();
        });

      } break;

      default: {
        throw new ApiError("ERROR: action '%s' not supported for $(prg.target) (must be one of 'get', 'add', 'del', 'mod')", prg.action);
      }
    }

  } break;

  // PKI Management
  case "pki": {

    // Debugging
    console.log("target '%s' action selected.", target);

    switch(prg.action) {

      case "get" : {
      } break;

      case "add" : {
      } break;

      case "del" : {
      } break;

      case "mod" : {
      } break;

      default: {
        throw new ApiError("ERROR: action '%s' not supported for $(prg.target) (must be one of 'add', 'del', 'mod')", prg.action);
      }
    }

  } break;

  // CA Management
  case "ca" : {

    // Debugging
    console.log("target '%s' prg.action selected.", prg.target);

    switch(prg.action) {

      case "get" : {
      } break;

      case "add" : {
      } break;

      case "del" : {
      } break;

      case "mod" : {
      } break;

      default:
        throw new ApiError("ERROR: action ['" + prg.action + "'] not supported for $(prg.target) (must be one of 'get', 'add', 'del', 'mod')", prg.action);
    }

  } break;

  default: {
    throw new ApiError("ERROR: target ['" + prg.target + "'] is not supported (must be one of 'usr', 'org', 'pki', or 'ca').", prg.target);
  }
} 

// All Done
return 0;

// ==================
// Internal Functions
// ==================

function OCAQuery( method, url, options, callback ) {

  var __callback = callback;
  
  switch (method) {
    case "get":
    case "post" :
    case "head" :
      break;

    default:
      throw new Error("Method '%s' not supported", method);
  }

  return req[method](url, options, (err, res, body) => {

    // Local Callback Variables
    var msg = null;
    var errMsg = null;

    // Builds the return message
    try {
      // In case of errors, let's return a JSON formatted
      // error message
      if (err) {
        errMsg = new OCAErr(500, "Error", err);
        msg = new OCAMsg(errMsg);
      } else {
        // Converts the body into an OCAMsg (if possible)
        if (typeof(body) === "undefined" || body == null) {
          msg = new OCAMsg();
        } else if (typeof(body) === "object" ) {
          msg = new OCAMsg(body);
  
        } else if (typeof(body) === "string" ) {
          try {
            msg = new OCAMsg(JSON.parse(body));
          } catch (e) {
            msg = new OCAMsg();
            msg.body(body);
          }
        }
      }
    } catch (e) {
      // Error while converting the returned data
      console.error("Error while generating OCAMsg");
      console.dir(e, 4, true);
    }

    if (!msg) {
      errMsg = new OCAErr(666, "Internal Error", { "res" : res, "err" : err, "body" : body });
      msg = new OCAMsg(errMsg);
    }

    // Save the info into the context (ctx) global var
    ctx.err = err;
    ctx.res = res;
    ctx.msg = msg;

    return __callback(msg, err, res);
  });
}


/* login() - Login function */
function login(prg) {

  return new Promise (function OCA$login$Promise(resolve, reject) {

  });
}

function logout() {
}

function banner() {
  console.log("\nOpenCA EasyPKI API - v0.0.1");
  console.log("Copyright (C) 2019 by Massimiliano Pala and OpenCA Labs");
  console.log("All Rights Reserved\n");
}
