/*
 * OCATools - Tools for Node.JS application
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// Self Reference
var tools = this;
var clone = require("clone");

// Requirements
const fs = require('fs');
const path = require('path');

// Basic Configuration Options
const basedir = path.normalize( __dirname +"/../data");

// Cache
var cache = { };

// Enables different caches
var enableCache = {

  // To Override the default behavior, sets the
  // different caching options for the different
  // formats, for example:
  //
  // "json" : true,
  // "html" : true,
  // "css"  : true,

  // Disables JavaScript Caching
  "js"   : false,

  // Default Behavior
  "default" : true,
};

// ==============================
// Generic Error Message Handling
// ==============================

exports.returnError = function tools$$return_error(req, res, ctx) {

      try {

        // TODO: The use of errMsg is to avoid circular dependencies
        //       We need to investigate what generates this issue (causes
        //       the res.json(msg) to generate an exception)
        var errMsg = new OCAMsg();
        errMsg.err(new OCAErr(ctx.msg.err()));
        errMsg.__msg["links"] = ctx.msg.__msg["links"];

        // Gets the redirect URL
        var redirectUrl = errMsg.next() || Urls['app'];
        errMsg.next(redirectUrl);

        // Gets the appropriate error code
        var errCode = errMsg.err().errno();
        if (errCode < 200) errCode = 401;

        // Builds the status code depending on the request method
        // to properly redirect the application in case it is needed
        if (/GET/i.test(req.method)) {
          // If GET, let's return an un-authorized request. This behavior
          // is different from POST because if we do a redirect here, the
          // requesting entity will just redirect the request, but not
          // redirect the whole page. We do not want that.

          // Checks the requested format for the data
          var fmt = req.query['f']

          // If the request path is a data path and fmt parameter
          // was not passed, let's default to html
          if (fmt == null && /^\/data\/u\//.test(req.path)) {
            // Defaults to html
            fmt = 'h';
          }

          // Matches either the '.*html$' path or the fmt parameter
          if (/html$/i.test(req.path) || fmt === 'h') {
            res.status(302);
            res.header('Location', redirectUrl);
          } else {
            res.status(errCode);
          }

        } else if (/POST/i.test(req.method)) {
          // If POST, let's directly redirect to the appropriate
          // request - this allows for automatic redirect to other
          // resources
          res.status(303);
          res.header('Location', redirectUrl);
        }

        // Sets the status and the return data
        res.json(errMsg);
        ctx.msg.clear();
        console.log("[DEBUG::tools$__return_error()] res.json completed");
        return; // All Done
      } catch (e) {
        // Here something went wrong with the JS and we
        // need to send out a generic internal error
        console.log("[DEBUG::tools$__return_error()] Exception Detected: " +
          e + "; " + JSON.stringify(e));

        var errMsg = new OCAMsg();
        errMsg.err(new OCAErr(500, "Internal Error Detected"));
        res.status(500);
        errMsg.next(redirectUrl);
        res.header('Location', redirectUrl);
        res.json(errMsg);
        ctx.msg.clear();
        return;
      }

      return; // Exits
};

// ===================
// Handlers Management
// ===================

// getHandler(obj, params) where:
//
//   obj = { method : '', path : '', func : '' }
//
// The 'obj' param is mainly used in lib/tools.js/registerHandlers()
//
//   params = { login : '', roles : [ ... ], deviceId: '' }
//
// The params object is used maily in the lib/auth.js/check()
//
exports.getHandler = function tools$$get_handler(obj, params, isAsync) {

  // Input checks
  if (!obj) return undefined;

  // Context Parametes. Defaults to required login (safe side).
  if (!params) {
    // If no parameters are passed, we default to login: true
    params = { login: true, reqAdmin: false, reqGlobalAdmin: false }

  } else if (typeof params.login !== "boolean") {
    // If the login was not specified, we default to login: true
    params.login = true;
  }

  // Checks the types for reqAdmin and reqGlobalAdmin
  if (typeof params.reqAdmin !== "boolean") {
    if (typeof params.reqAdmin !== "undefined") {
      console.log("ERROR: params.reqAdmin is not a boolean (value: %s)",
        params.reqAdmin);
    }
    // Fix the error
    params.reqAdmin = false;
  }

  // Checks the types for reqGlobalAdmin
  if (typeof params.reqGlobalAdmin !== "boolean") {
    if (typeof params.reqGlobalAdmin !== "undefined") {
      console.log("ERROR: params.reqGlobalAdmin is not a boolean (value: %s)",
        params.reqGlobalAdmin);
    }
    // Fix the error
    params.reqGlobalAdmin = false;
  }
  // Reports an Error if the Async is not explicitly set
  if (typeof isAsync === 'undefined') {
    console.log("WARNING: isAync not set for " + obj.path);
  }

  // Let's now register the inner function as the callback
  var preamble = (function __auth_wrapper_setup() {

    // Reference to this object
    var ctx = {
      "auth"    : params,
      "isAsync" : isAsync,
      "func"    : obj.func,
      "msg"     : null
    };

    // Wrapping Callback which provides auth checking
    return function __auth_wrapper(req, res) {

      // Sets the default content type to also return the encoding
      res.header("Content-Type", "application/json; charset=UTF-8");

      // Resets the ctx.msg
      ctx.msg = new OCAMsg();
      ctx.sessionID = undefined;
      ctx.sessionData = undefined;

      // Let's verify the authorization
      lib.auth.checkAuth(req, res, ctx, function(req, res, ctx) {

        // Proxy for the Callback function
        var cbFunc = ctx.func;

        // If errors were set, let's send the message, and return
        if (ctx.msg.err()) {
          console.log("[DEBUG::tools$__auth_wrapper()] After checkAuth() - Detected Error: " + JSON.stringify(ctx.msg.err()));
          console.log("[DEBUG::tools$__auth_wrapper()] After checkAuth() - req.path = " + req.path);
          // Sends out the error
          tools.returnError(req, res, ctx);
          return; // All Done
        }

        // For Asynchronous handlers, we need to wrap the callback
        // so that the req and res parameters are not going away
        if (ctx.isAsync === true) {

          // Returns the function with the req, res context saved
          cbFunc = (function(__ctx) {

            // Saved References
            var req = req;
            var res = res;
            var ctx = __ctx;

            // Returns the original function
            return ctx.func;
          })(ctx);
        }

        try {
          // Calls the original function
          cbFunc(req, res, ctx);

        } catch (e) {
          // We use exceptions to convey functional errors
          // (not errors that are meant for the user, but
          // internal bugs)
          console.log("[ERROR::tools$__auth_wrapper()] Exception: " + e +
            " (path: " + req.path + ")");
          // Sets the error message
          ctx.msg.err(new OCAErr(500, "Internal Error"));
          // Sends out a generic error
          tools.returnError(req, res, ctx);
          // All Done
          return;
        }

        // Sends the message in the non-async case. Note that in
        // the async case, the handler is supposed to send the response
        // directly
        if (ctx.isAsync != true) {

          // Checks if we have any content, if not, we might
          // have executed some async and the message is not
          // being sent correctly (sent before everything is
          // done).
          if (ctx.msg.err == null && ctx.msg.body == null) {

            // Generates the error message
            ctx.msg.err(new OCAErr(500, "Internal Error"));
            // Generates and return the error message
            tools.returnError(req, res, ctx);
            // Cleanup the CTX message
            ctx.msg.clear();
            return;

          } else {

            // Sends the message
            res.status(200).json(ctx.msg);
            // All Done
            return;
          }

        } // End of ctx.isAsync != true

      }); // End of lib.auth.checkAuth

    }; // End of __auth_wrapper

  })(); // End of preamble assignment

  // Assigns the preamble function as the func
  obj.func = preamble;

  // Returns the modified handler
  return obj;
};

// Registers an array of handlers
exports.registerHandlers = function (router, handlers) {

  // Checks the input
  if (router == null || handlers == null) return;

  // Goes through the array of function objects. The structure
  // is as follows:
  //
  //   { method: "", path: "", func: function() {}}
  //
  // allowed methods are "get", "post", "put", "delete"
  for (var idx = 0; idx < handlers.length; idx++) {

    // Gets the Method (if none, defaults to get
    var method = ( handlers[idx].method ? handlers[idx].method : "get" );

    // Gets the Path and the callback
    var path = handlers[idx].path;
    var func = handlers[idx].func;

    // Validates the allowed method
    switch (method) {

      // Fall through for good methods
      case "get":
      case "post":
      case "put":
      case "delete":
        // Method is allowed
        break;

      default:
        // Here the method is not recognized, therefore rejected
        console.log("Method (" + method + ") unknown for path (" + path + ")");
        return;
    }

    // registers the handler with the router
    router[method](path, func);
  }
};

// ==================
// Session Management
// ==================

exports.updateSessionData = function tools$$update_session_data(req, res, ctx) {
}

// =====================
// Static Data Retrieval
// =====================

exports.getStaticData = function tools$$get_static_data(params, cb) {

  // Function Variables
  var srcPath = undefined;
  var encoding = 'utf-8';

  // Input Checks: required oaraneters
  if (typeof(params)      !== "object"  ) throw new ApiError("ERROR: params must be an object");
  if (typeof(params.name) !== "string"  ) throw new ApiError("ERROR: name is not a string");
  if (typeof(cb)          !== "function") throw new ApiError("ERROR: cb is not a function");

  // Input Checks: optional parameters
  if (typeof(params.isPublic) === "undefined") params.isPublic = true; // Defaults to public
  if (typeof(params.fmt)      === "undefined") params.fmt = "html"; // Defaults to HTML
  if (params.srcPath && typeof(params.srcPath) !== "string") throw new ApiError("ERROR: srcPath is not a string");

  // Sets the value of srcPath to basedir in case none was provided
  if (!params.srcPath) {

    // Sets the right directory for public or private (user) calls
    if (params.isPublic) srcPath = path.join (basedir, "pub", params.fmt.toLowerCase());
    else srcPath = path.join(basedir, "user", params.fmt.toLowerCase());

  } else {

    // If the path is provided, let's use it entirely if it is an
    // absolute path, otherwise we add it as a subdir of the data path
    if (path.isAbsolute(params.srcPath) != true) {
      // Prepends the basedir and normalizes
      srcPath = path.join(basedir, path.normalize(params.srcPath.replace("..", "")));
      if (params.isPublic) srcPath = path.join(basedir, "pub", path.normalize(params.srcPath));
      else srcPath = path.join(basedir, "user", path.normalize(params.srcPath));
    } else {
      // Just use the normalized version of the passed srcPath
      srcPath = path.normalize(params.srcPath);
    }
  }

  // Make a local copy for the callback
  var src = path.join(srcPath, params.name.replace("..", ""))
  if (params.fmt.length > 0) {
    src += "." + params.fmt.toLowerCase();
  }

  // Checks if we have a cache already
  if (typeof(cache[src]) !== "undefined") {
    // Returns the cached data
    return cb(cache[src]);
  }

  // Loads from the FS
  fs.readFile(src, params.encoding, function(err, data) {

    // JSON return body
    var json = undefined;
    var isCached = false;

    // Error while reading the file
    if (err != null) {
      console.log("[tools::getStaticData] Internal Error (err: " + err + ")");
      return cb(null);
    }

    // Processing based on the type
    if (params.fmt == 'json') {

      // If a JSON is expected, try to parse it before caching it
      // and returning it to the client
      try {

        // Parse the data - validate JSON (strict mode)
        json = JSON.parse(data);

      } catch (e) {
        // Let's Fix the JSON before parsing it
        var data_new = data.replace(/(['"])?([^\s]+)(['"])?\s*\:\s*(.*)/g,
                                    '"$2" : $4');

        try {

          // Parses the modified data
          json = JSON.parse(data_new);

          // Reports the issue with the JSON to be fixed
          if (!src.match("mock-data")) {
            console.log("[ERROR] " + src + " is not a strict JSON file, fix it!");
          }

        } catch (f) {

          // Reports the NON RECOVERABLE error
          throw "[ERROR] " + src + " is not a valid JSON file (ex: " + f + ")";
        }
      }

      // Saves the new parsed json into the 'data' variable
      data = json;
    }

    // Just memoizes the data (no processing)
    if (typeof(enableCache[params.fmt]) != 'undefined') {
      // Memoizes only if the format is set to be cached (or if default
      // value is set to true)
      if (enableCache[params.fmt] || params.forceCache) {
        cache[src] = data;
        // Sets the appropriate value for the cache
        isCached = true;
      } else if (enableCache.default == true) {
        cache[src] = data;
        isCached = false;
      }
    }

    // Call the callback
    return cb(data, isCached);
  });
};


//
// Private Data Methods (login required)
//

exports.getMockData = function tools$$get_mock_data(dir, name, fmt, cb) {

  // Builds the filename
  var src = path.join(dir, "mock-data");
  var params = { "name" : name, "fmt" : "json", "isPublic" : false, "srcPath" : src };

  // Calls the Get Static Data with the isJSON bit set to true
  return tools.getStaticData( params, cb);
};

exports.getStaticHTML = function tools$$get_static_html(name, cb) {

  // Parameters
  var params = { "name" : name, "fmt" : "html", "isPublic" : false };

  // Calls the Get Static Data with the appropriate subdirectory
  return tools.getStaticData(params, cb);
};

exports.getStaticJS = function tools$$get_static_js(name, cb) {

  var params = { "name" : name, "fmt" : "js", "isPublic" : false};

  // Calls the Get Static Data with the appropriate subdirectory
  return tools.getStaticData(params, cb);
};

//
// Public Data Retrieval Methods (login NOT required)
//

exports.getPublicJSON = function tools$$get_static_json(name, cb) {

  // Calls the Get Static Data with the isJSON bit set to true
  return tools.getStaticData({ "name" : name, "fmt" : "json", "isPublic" : true }, cb);
};

exports.getPublicJS = function tools$$get_public_js(name, cb) {

  var params = { "name" : name, "fmt" : "js", "isPublic" : true };

  // Calls the Get Static Data with the appropriate subdirectory
  return tools.getStaticData(params, cb);
};

//
// User Tools
//

exports.sanitizeUserId = function OCAtools$sanitizeUserId(userId) {
  if (!userId || typeof userId !== "string") throw new ApiError("Missing userId");
  return userId.replace(/[.!/$]+/gi, "");
}

// ======================
// Prototype Enhancements
// ======================

Array.prototype.has = function(data) {
  var i = -1;
  while (i++ < this.length) {
    if (this[i] === data || this[i] == data) return true;
  }
  return false;
}

Array.prototype.sum = Array.prototype.sum || function() {
  return this.reduce(function(sum, a) { return sum + Number(a) },  0);
}

Array.prototype.average = Array.prototype.average || function() {
  return this.sum() / (this.length || 1 );
}

/*
Object.prototype.getName = function() {
   var funcNameRegex = /function (.{1,})\(/;
   var results = (funcNameRegex).exec((this).constructor.toString());
   return (results && results.length > 1) ? results[1] : "";
};
*/

exports.deepCopy = function OCA$deepCopy (obj) {

    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}
