/*
 * OpenCA Labs AUTH driver (PostgreSQL)
 * Copyright (c) 2016 Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// This Object
var me     = this;

// Crypto Object
me.sec     = null;
me.db      = null;

// Initializes
exports.init = function auth$init(db, crypto) {

  return new Promise(function auth$init$Promise(resolve, reject) {

    try {

      // Input Checks
      if (crypto == null) { // || db == null) {
        console.log("[DEBUG] Error: missing required parameters");
        reject(new ApiError("Missing required parameters",
          { "crypto" : crypto, "driver" : driver }));
        return;
      }

      // Local reference to the sec object
      me.sec = crypto;
      // me.db = db;

      // Loads Mock Data on startup
      /*
      lib.tools.getMockData( __dirname,"users-data", "json", function(data) {
          if (data == null) {
            console.log("[clients.js]: Error loading mock data");
          return;
        }
        // Assigns the data to the internal variable
        users = data;
      });
      */

      // All Done, no data to return
      resolve(true);

    } catch (e){
      // Propagates the error
      reject(new ApiError("Exception: " + e, e));
    }

  }) // End of new Promise()
}

// Checks that the auth in 'ctx' are valid (from req's cookie)
exports.checkAuth = function auth$$checkAuth(req, res, ctx, cb) {

  // Shortcut to the CTX's roles (if any)
  var uRoles = [];

  // Checks we have a good ctx, if not, let's return false
  // (default: we need to know what auth is required)
  if (!ctx) throw new ApiError("Handler set without proper Auth Params!");

  // Checks we have a good Callback
  if (req == null || res == null || typeof(cb) !== "function") {
    // Generates a new loggable ApiError
    console.log(new ApiError("missing arguments",
      { "req" : req, "res" : res, "ctx" : ctx, "cb" : cb }));
    // Generates a new Error message
    ctx.msg.err(new OCAErr(-2, "Internal Error"));
    // Sets the next page to be the main app one
    ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    // All Done
    return;
  };

  // Clears previous errors
  ctx.msg.clear();
  // console.log("[DEBUG::auth$checkAuth()] Cleared ctx message = " + JSON.stringify(ctx.msg));

  // Checks if we have already a session, if so, let's just continue
  // and invoke the Callback. Also, if we do not require the login
  // for the current handler, let's invoke the callback
  if (ctx.auth.login != true || ctx.sessionData != null) {
    // Debug Info
    // console.log("[DEBUG::auth$checkAuth()] " +
    //  "No Login or Already have SessionData: login = " +
    //  ctx.auth.login + " (" + typeof(ctx.auth.login) + "), sessionData = " +
    //  ctx.sessionData + " (" + typeof(ctx.sessionData) + ")");

    // Invoke the Callback and return
    cb(req, res, ctx);
    return; // All Done
  }

  // From this point on, we need a valid login. This means that the Received
  // request need to provide the session cookie.
  if (req.cookies[SessionsConfig.cookieName] == null) {
    console.log("[DEBUG::auth/checkAuth()] Missing Required Cookie");
    // Generates a new Error message
    ctx.msg.err(new OCAErr(-1, "No Valid Login Detected"));
    // Sets the next page to be the main app one
    ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    return;
  }

  // Let's memoize the parameters
  var req = req;
  var res = res;
  var ctx = ctx;
  var cb  = cb;

  // From this line on, we require a valid login token to process
  // the request, therefore we check if we have the loginToken set
  // in the CTX. If we do not have one, let's get it from the
  // presented request cookie (eToken)
  // console.log("[DEBUG] Login Required for (" + req.path + ")");

  // We need to decrypt the cookie and assign it to the
  // loginToken of the ctx
  // ctx.sessionId = Sec.decrypt(req.cookies[SessionsConfig.cookieName]);
  ctx.sessionId = req.cookies[SessionsConfig.cookieName];

  // console.log("[DEBUG] Got SessionId = " + ctx.sessionId);

    // Let's query for the specified Session ID and see if it is
    // a valid session, if not, we do reject
    // Db.getSession(ctx.sessionId)
      // Got the session information
      // .then(function(data) {

        // Saves the session data in the context
        ctx.sessionData = SessionsConfig.currSessions[ctx.sessionId];

        // console.log("[DEBUG::auth$checkAuth()] Got Session data = " +
        //   JSON.stringify(data && data[0] ? data[0] : data));

        // Checks we have some data to process
        if (typeof ctx.sessionData === "undefined" || ctx.sessionData == null) {
          console.log("[DEBUG::auth$checkAuth()] No Session Data Available");
          // Generates a new Error message
          ctx.msg.err(new OCAErr(-1, "Session Error"));
          // Sets the next page to be the main app one
          ctx.msg.next(Urls['app']);
          // Reports the Error
          cb(req, res, ctx);
          return null;
        }

        // DEBUG Information
        // console.log("[DEBUG::auth$checkAuth()] data = " + JSON.stringify(data));


        // Now we need to check the freshness of the session
        // DEBUG information
        // console.log("[DEBUG::auth$checkAuth()] Got Cookie Data: " +
        //  JSON.stringify(ctx.sessionData));
        // Current Time
        var now = new Date();

        // Last Update for the Session
        var updated = new Date(ctx.sessionData.updated_on) ||
                      new Date(ctx.sessionData.started_on);

        console.log("[DEBUG::auth$checkAuth()] Now (" + now + ") vs. updated (" + updated + ")");

        // Expiration for the current
        var expire = new Date(updated.getTime() + SessionsConfig.maxUpdateAge);

        console.log("[DEBUG::auth$checkAuth()] Expire (" + expire + ")");

        // Checks for expiration
        if (now > expire) {
          console.log("[DEBUG::auth$checkAuth()] Session Expired");
          // Generates a new Error message
          ctx.msg.err(new OCAErr(-1, "Session Expired"));
          // Sets the next page to be the main app one
          ctx.msg.next(Urls['app']);
          // Reports the Error
          cb(req, res, ctx);
          return null;
        }

        // Calls the Callback to Proceed
        console.log("[DEBUG::auth$checkAuth()] Ready To Proceed, calling callback");
        
        try {
          cb(req, res, ctx);
        } catch (err) {
          console.log("[DEBUG::auth$checkAuth()] ERROR: " + ctx + " (async: " + ctx.isAsync + ")");
          new ApiError( err, { "source" : "auth.js/196"});
          console.log("******** DEBUG *******: cb: " + cb);
          console.log("******** DEBUG *******: ctx.func: " + ctx.func);
        }

        // All Done
        return;


        // ===========================================================
        // NOTE:
        //
        // The following code is NEVER executed because the logic for
        // roles management is actually changed and still needs to be
        // implemented here
        // ===========================================================

        /*
        // Invokes the process function. Note that it could have just been
        // implemented in this .then(), however for sake of readability
        // we moved the body of the function in the separate variable
        console.log("[DEBUG::auth$checkAuth()] Processing Session: " + JSON.stringify(ctx));

        // Points the 'roles' to the loginToken reference
        var uRoles = ctx.loginToken ? ctx.loginToken.roles : [];

        // Checks permissions
        if (ctx.roles && ctx.roles.length > 0) {
          // Checks for the roles. Roles can be a name and a
          // modifier. To indicate that a role is a MUST-HAVE
          // use a '+' at the beginning of the role name. If
          // the '+' is not specified, the role is a logical
          // 'OR' with the others (requires one of the listed
          // roles and all of the MUST-HAVE ones). For example:
          //
          // { roles : [ "agent", "user", "+usradm" ] }
          //
          // Indicates that any "agent" or "user" with a "usradm" role can
          // execute the query

          console.log("DEBUG: Users Roles = " + JSON.stringify(uRoles));
          console.log("DEBUG: Roles To Check = " + JSON.stringify(ctx.roles));

          // Keeps track of matching at least one required role
          var matched = false;

          // Cycles through the list of roles in a page (usually
          // smaller set than the list of roles in a user)
          for (var i = 0; i < ctx.roles.length; i++) {

            // Initial Setting for the Role Checks
            var name = ctx.roles[i];

            // Goes throught the role, checks if it is a required
            // one (or just a "one of these" entries) and generates
            // the required message
            if (ctx.roles[i].match(/^\+/)) {

              // Removes the '+' from the name of the role
              name = ctx.roles[i].substr(1);

              console.log("DEBUG: Checking against required " + name + " (" +
                ctx.roles[i] + ")");

              // Here, the role MUST be in the user array
              if (!uRoles.has(name)) {
                // We rely on the standard "Not Authorized" message that
                // is automatically built in the tools.js::getHandler::__auth_wrapper()
                ctx.msg.err(new OCAErr(-1, "Missing required authorization level"));

                return false;
              }

              // Sets the matched value to true
              matched = true;

            } else {

              console.log("DEBUG: Checking AUTH against " + ctx.roles[i]);
              if (uRoles.has(name)) {
                matched = true;
              }
            }

            // We do not have a matched role, let's return the error
            if (matched == false) {
              ctx.msg.err(new OCAErr(-1, "Missing any of the required authorization levels"));
              return false;
            }
          }

          // If we are here, it means all '+' required roles have
          // checked out and we matched at least one role (could be
          // also one of the not MUST-HAVE ones)
        }
        cb(req, res, ctx); // All Done
        return; // Safety
        */

    /*    
      })
      .catch(function(error) {
        // Checks if it was a JS exception
        if (ctx.msg.err() == null) {
          console.log("[DEBUG::auth$checkAuth()::catch()] JS Catch Error : " +
            JSON.stringify(error));
          // Can not login
          ctx.msg.err(new OCAErr(-1, "Internal Error"));
        } else {
          console.log("[DEBUG::auth$checkAuth()::catch()] APP Catch Error : " +
            JSON.stringify(error));
          // Sets the next page to be the main app one
          ctx.msg.next(Urls['app']);
        }
        // Reports the Error
        cb(req, res, ctx);
        // All Done
        return;
      }); // End of Db.getSession Promise Chain
    */
};

// Function to check the user's credentials. We use Promises
// to provide the possibility to concatenate actions after
// the check is performed (e.g., updating the session table,
// etc.)
//
// Parameters:
// @user - It is the user identifier string (e-mail)
// @creds - It is a JSON object with { "type" : string, "value" : string }
//          structure. Supported "type" is [ "password" ]. The "value" depends
//          on the type of credentials. For "password" credentials, the "value"
//          is the user's secret
exports.checkCredentials = function(user, creds) {

  // Returns the promise
  return new Promise(function(resolve, reject) {

    try {

      // Container for the Query String
      var queryStr = "";
      var queryParams = {};

      // Checks the input parameters
      if (typeof(user) !== "string" ||  typeof(creds) !== "object") {
        // Returns the error
        reject(new ApiError("missing paramter",
          { "user" : user, "creds" : creds }));
        return;
      }

      // Performs the actual query, we do perform different queries depending
      // on the type of credentials
      switch (creds.type) {

        // Password Credentials
        case "password": {

          // DEBUG Information
          console.log("INFO: login for (" + user + ") with creds type (" + creds.type + ")");

          // Builds the Query String (uses the function in PGSQL)
          queryStr = "SELECT (people_check_secret(${user}, ${secret})).* ";
          queryParams = { "user" : user, "secret" : creds.value };

          // Executes the Query
          me.db.query.one(queryStr, queryParams)
            // Success Promise
            .then(function(data) {
              // DEBUG information
              console.log("[DEBUG::auth/checkCredentials()] data.validcreds = " + data.validcreds);
              // Checks for the validity, if not valid, let's reject
              if (data.validcreds != true) {
                console.log("[DEBUG::auth/CheckCredentials()] rejecting");
                reject(data);
                return null;
              }
              // Calls the Callback
              resolve(data);
              return; // Safety
            })
            // Error Condition
            .catch (function(err) {
              // Sets the Error condition in the message
              reject(new ApiError("Error checking the user",
                { "query" : queryStr, "params" : queryParams, "err" : err }));
              return; // Safety
            });
        } break;

        // Other Creds Type
        default : {
          // Propagates the error
          reject(new ApiError("Authentication type not supported",
            { "credsType" : creds.type }));
          return;
        }

      } // End of Switch

    } catch (e) {
      // Propagates the error
      reject(new ApiError("Exception: " + e, e));
    }
  }) // End of Promise
};
