/*
 * OpenCA Data Driver
 * Copyright (c) 2019 Massimiliano Pala and Teza Realty
 * All Rights Reserved
 */

// This Object
var me     = this;

// Local: Require Options
var reqOptions = { "recurse" : true, "extensions" : [ '.js', '.json' ], 
  "filter" : function (path) {
      return (path.match(/._.*/) ? false : true); }
  };

// Basic Configuration Options
me.name = "";
me.host = "";
me.port = "";

// DB Driver
// me.driverOptions = { promiseLib: require('bluebird') };
me.driver = require('sqlite3');

// Query Object
me.query = null;

// CryptoObject
me.sec = null;

// Status
me.initSuccess = false;

// Internal Data Structures
me.orgs = {};
me.pkis = {};

exports.init = function OCAdata$init(params, crypto) {

  // Input Checks
  if (crypto == null) throw "Crypto Object is required!";

  // Local copy of the parameters
  var params = params;
  var crypto = crypto;

  return new Promise(function OCAdata$init$Promise(resolve, reject) {

    // Local reference to the sec object
    me.sec = crypto;

    // Loads all the Organization Files from conf/orgs directory (recursive)
    OCAcnf.orgs = require("require-dir")("./../conf/orgs", reqOptions);

    // Cycles through all organization and provides some output
    for (var i in OCAcnf.orgs) {
      // Shortcut to the Organization
      var orgObj = OCAcnf.orgs[i];
      // Skips if it is not an Organization Object
      if (typeof(orgObj) !== "object") continue;
      // Logs the Organization details
      console.log("  - %s [ Admin: %s; Users: %d; Id: %s; FileName: conf/orgs/%s ]", 
        orgObj.name, (orgObj.isAdminOrg == null ? "false" : "true"), 
        orgObj.users.length, orgObj.id, i + ".json");
      console.log("    Enabled PKIs: ", orgObj.enabledPkis);
    }

    // Info Output
    console.log("\n* Configured PKIs:");

    // Load all the PKI Files from the conf/pkis directory (recursive)
    OCAcnf.pkis = require("require-dir")(__dirname + "/conf/pkis", {recurse: false});

    // Cycles through all the configured PKIs and provides some info
    for (var i in OCAcnf.pkis) {
      // Skips output for the non-object data
      if (typeof(OCAcnf.pkis[i]) !== "object") continue;
      // Logs the PKI Name
      console.log("  - %s [%s]:", OCAcnf.pkis[i].description, OCAcnf.pkis[i].id);
      // Gets the name of the configured CAs
      for (var j in OCAcnf.pkis[i].calist) {
        // Gets the reference
        var caObj = OCAcnf.pkis[i].calist[j];
        // Skips logging if not a CA object
        if (typeof(caObj) !== "object") continue;
        // Logging info for loaded CAs
        console.log("    + %s - %s", caObj.id, caObj.description);
      }
    }

    // Performs login
    return me.login(user);
  });
}

// login() - function to login into the DB
//
// params:
// @user - userId to login with. The '@user' shall be one of the ones saved
//         in the 'accounts' object
exports.login = function OCAdata$login( params ) {

  // Makes a local copy of the parameters
  var params = params;

  return new Promise(function OCAdata$login$Promise(resolve, reject) {

    // Checks the Crypto Status
    if (me.sec == null) {
      reject (new OCAErr ("Error: initCrypto required first!", { "params" : params }));
    }
    
    // Input check
    if (params.id == null || params.creds == null || params.creds.value == null) {
      reject(new OCAErr("User not found!", { "user" : user }));
    }

    // build the connection string
    var secret = me.sec.decrypt(accounts[user]);
    var connStr  = "postgres://" + user + ":" + secret +
      "@" + me.host + ":" + me.port + "/" + me.name;

    // Assigns the connection parameters
    me.query = me.driver(connStr);

    // Executes the resolve or reject depending on the
    // status of th db.query
    if (!me.query) {
      // Make sure we do not report successful init
      me.initSuccess = false;
      // Error, no successful login detected
      reject(new Err("Error while logging in"));
    } else {
      // Updates the DB module status
      me.initSuccess = true;
      // All Done
      resolve(true);
    }

  }) // End of new Promise()

};

exports.isInitialized = function OCAdata$isInitialized() {
  return (me.initSuccess === true);
};

// getUserUUID() - Returns the UUID associated with a user login string
//                 (successful), or a KaErr (failure)
//
// Params:
// @user - User's login string (email)
//
// Returns:
// @onResolve (string) carrying the UUID
// @onReject (KaErr) carrying the failure Information
exports.getUserUUID = function OCAdata$getUserUUID(user) {

  // Returns the Promise
  return new Promise(function OCAdata$getUserUUID$Promise(resolve, reject) {

    // Input Check
    if (typeof(user) !== "string") {
      // Calls the callback
      reject(new ApiError("missing 'user' parameter"));
      return;
    }

    // Calls the DB function to retrieve the UUID of a user's
    // login credentials
    var qString = "SELECT people_get_uuid(${user}) AS uuid";

    // Query the DB (expected one result only)
    me.query.one(qString, { "user" : user })
      // Success Case
      .then(function(data) {
        // On Success returns the UUID string
        resolve(data['uuid']); // Safety
      })
      // Error Case
      .catch(function(err) {
        // On Error, returns the KaErr with associated info
        reject(new ApiError("Error querying DB",
          { "user" : user, "err" : err }));
        return; // Safety
      });
  });
};

// getUserData() - Returns the user data associated with an active UUID
//
// Params:
// @userID - User's UUID
//
// @params - JSON object for specifying additional parameters for the
//           search. Currently supported values are:
//
//           userStatus (string) - if specified (defaults to "active"),
//             the search for the data will be from the specified subset
//             of accounts. Valid values are: 'active' for any type of
//             users. For agents only, supported values also include
//             'suspended' (for suspended agents' list) and 'removed'
//             (for removed agents).
//
//           companyID (UUID) - if specified, the search will be
//
// Returns:
// @onResolve (JSON) carrying the user's information (people + active_{type})
// @onReject (ApiError) carrying the failure Information
exports.getUserData = function OCAdata$getUserData(userID, params) {

  // Returns a Promise
  return new Promise (function OCAdata$getUserData$Promise(resolve, reject) {

    // Initial Query String
    var queryStr = "SELECT is_agent, is_client, is_landlord, is_admin, can_admin " +
                   "FROM roles WHERE id = ${userID}";
    var queryParams = { "userID" : userID };
    var userData = { };

    var queryTablesPrefix = (params != null && params.userStatus != null ?
      params.userStatus : 'active');

    // Let's make sure the userStatus parameter (if passed) is one of
    // the allowed values
    switch (queryTablesPrefix) {
      case "active":
      case "suspended":
      case "removed":
        break;

      default:
        reject(new ApiError("userStatus " + queryTablesPrefix +
          "not supported", { "queryParams" : params }));
    }

    // Let's query the DB for the Type of account
    me.query.oneOrNone(queryStr, queryParams)
      // Once we got the roles, we query the right active table
      .then(function(data) {

        // Array for the table(s) to query
        var queryTables = [];

        // Sets the base query
        queryStr = "SELECT * from @TABLE@ WHERE id = ${userID}";
        queryParams = { "userID" : userID };

        // Saves the roles information
        userData.roles = data;

        // Builds the new query based on the type of profiles we have for the
        // user/agent
        if (userData.roles.is_agent == true) {
          // Let's query the 'agents' table. This case supports also the
          // suspended and removed 'userStatus' flags
          if (queryTablesPrefix.match("active")) queryTables = [ "active_agents" ];
          else if (queryTablesPrefix.match("suspended")) queryTables = [ "suspended_agents" ];
          else if (queryTablesPrefix.match("removed")) queryTables = [ "removed_agents" ];
        } else if (userData.roles.is_client == true) {
          // Let's query the active_clients table
          if (queryTablesPrefix.match("active")) queryTables = [ "active_clients" ];
        } else if (userData.roles.is_landlord == true) {
          // Let's query the active_landlords table
          queryTables = [ "active_landlords" ];
        } else if (userData.roles.is_admin == true) {
          // Let's query the active_landlords table
          if (queryTablesPrefix.match("active")) queryTables = [ "active_admins" ];
        } else {
          // We do not know the profile for this user, let's return the
          // error to the caller
          reject(new ApiError("Unknown Role",
            { "userID" : userID, "roles" : roles }));
          return;
        }
        // Checks we have the queryTables filled it
        if (queryTables.length < 1) {
          reject(new ApiError("Unsupported userStatus for Agents",
            { "queryParams" : params }));
          return;
        }
        // Replaces the Table(s) to query from
        queryStr = queryStr.replace("@TABLE@", queryTables.join(", "));
        // Executes the query (returns the Promise)
        return me.query.one(queryStr, queryParams);
      })
      .then(function(data) {
        // Here we have the user data to return to the caller
        resolve(data);
        return; // Safety
      })
      .catch(function(err) {
        // An Error occurred while querying, let's reject with all the
        // debugging infor attached
        reject(new ApiError("getUserData",
          { "userID" : userID, "queryStr" : queryStr,
            "queryParams" : queryParams, "err" : err }));
        return; // Safety
      })

  }); // End of new Promise
};

// Returns a Promise for retrieving sessions associated to a userID
//
// Params:
//
// @userID - The UserID should be the UUID for the User we want
//           to delete sessions for
// @params - An object that determines the behavior of the deletion.
//           In particular, the checked properties are:
//
//           params.sessionType (string): specifies the ID of the session to
//             be deleted. Currently supported values are 'mobile' and
//             'desktop'
//
//           params.includeExpired (boolean): if set to true, the method will
//             return all sessions (valid and expired)
exports.getUserSessions = function OCAdata$getUserSessions(userID, params) {

  // Returns the Promise
  return new Promise(function OCAdata$getUserSessions$Promise(resolve, reject) {

    // Use an exception catcher as Promises do not propagate
    // exceptions - therefore some error conditions might be
    // difficult to debug if the exception is not caught
    try {
      // Input Checks
      if (typeof(userID) !== "string") {
        reject(new ApiError("Missing or wrong user param"),
          { "userID" : userID });
        return;
      } else if (typeof(params) !== "object") {
        reject(new ApiError("Wrong Params object", { "params" : params}));
        return;
      }

      console.log("[DEBUG::OCAdata$getUserSessions()] Started!");

      // Container for the query parameters
      var queryParams = { "userID" : userID };

      // Base Query Data
      var getQuery = "SELECT * from sessions ";
      var getQueryWhere = "WHERE user_id = ${userID} ";

      // If we have the sessionType, let's filter on it
      if (params.sessionType != null) {
        queryParams.sessionType = params.sessionType;
        getQueryWhere += " AND session_type = ${sessionType}"
      }

      // If only valid sessions are to be returned (with the
      // params.includeExpired === true) we add the clause on the startedOn
      // and updatedOn to exclude expired ones.
      if (params.includeExpired != true) {
        getQueryWhere += " AND started_on > now() - "  + SessionsConfig.maxLifespan +
          " AND updated_on > now() - " + SessionsConfig.maxInactivity;
      }

      // throw "DEBUG - ERROR";

      // Performs the query and returns the returned information
      // as returned from the DB driver
      me.query.any(getQuery + getQueryWhere, queryParams)
        // Once we have the requested sessions, let's just
        // return it to the calling method
        .then(function(data) {
          // Propagate the returned data
          resolve(data);
          return; // Safety
        })
        .catch(function(err) {
          // Detected an error, let's propagate it
          reject(new ApiError("Error Querying DB",
            { "userID" : userID, "params" : params, "query" : getQuery, "err" : err }));
          return; // Safety
        });

    } catch (ex) {

      // Propagates the error to the original caller
      reject(new ApiError("Exception: " + ex,
        { "exception" : ex, "userID" : userID }));

    } // End of try { ... } catch () { ... }

  }); // End of Promise
};

// Returns a Promise for deleting sessions related to a userID
//
// Params:
//
// @userID - The UserID should be the UUID for the User we want
//           to delete sessions for
// @params - An object that determines the behavior of the deletion.
//           In particular, the checked properties are:
//
//           params.sessionID (string): specifies the ID of the session to
//             be deleted
//
//           params.expiredOnly (boolean): if set to true, the method will
//             delete only expired sessions
//
//           params.sessionType (string): specifies the type of the
//           new session to be created (existing sessions with the
//           same type will be deleted before creating the new one)
exports.delUserSessions = function OCAdata$delUserSessions(userID, params) {

  return new Promise(function OCAdata$delUserSessions$Promise(resolve, reject) {

    // Use an exception catcher as Promises do not propagate
    // exceptions - therefore some error conditions might be
    // difficult to debug if the exception is not caught
    try {

      // Make sure we have an object in the 'params' parameter
      if (params == null) params = {};

      // Delete Session
      var delQuery = "DELETE FROM sessions ";
      var delQueryWhere = "WHERE user_id = ${userID} ";
      var delParams = { "userID" : userID };

      // Let's check if we want to delete a specific sessionID
      if (params.sessionID != null) {
        delParams.sessionID = params.sessionID;
        delQueryWhere += " AND id = ${sessionID}";
      }

      // Let's check if we want delete only expired sessions
      if (params.expiredOnly) {
        delQueryWhere += " AND (started_on < now() - " + SessionsConfig.maxLifespan +
                    " OR updated_on < now() - " + SessionsConfig.maxInactivity;
      }

      // Let's check for the type of session
      if (params.sessionType) {
        delParams.sessionType = params.sessionType;
        delQueryWhere += " AND session_type = ${sessionType} OR session_type IS NULL ";
      }

      // Returns the Promise from the DB Driver
      me.query.none(delQuery + delQueryWhere, delParams)
         // This wrapper is needed so we can return the KaErr in the catch()
         .then(function (data) {
           // Returns null as there is not data that is Expected
           // to be returned
           console.log("[DEBUG::OCAdata$delUserSessions] DB User Sessions Deleted");
           resolve(data);
           return; // Safety
         })
         .catch(function(err) {
           // Returns a KaErr object that carries all the extra
           // information required for good Debugging
           console.log("[DEBUG::OCAdata$delUserSessions] ERROR: can not delete user sessions");
           reject(new ApiError("Error deleting Sessions",
             { "userID" : userID, "params" : params, "err": err }));
           return; // Safety
         })

    } catch (ex) {
      // Propagates the error to the original caller
      reject(new ApiError("Exception: " + ex,
        { "exception" : ex, "userID" : userID }));
    } // End of try { ... } catch () { ... }

  }); // End of Promise

};

// Returns a Promise for generating a new session related to user
//
// Params:
//
// @user - The 'user' should be the login string for the User we want
//           to create the new session for
// @params - An object that determines the behavior of the deletion.
//           In particular, the checked properties are:
//
//           params.sessionType (string): specifies the type of the
//           new session to be created (existing sessions with the
//           same type will be deleted before creating the new one)
exports.newSession = function OCAdata$newSession(data, params) {

  return new Promise(function(resolve, reject) {

    try {

      // Input check
      if (data == null || data.id == null) {
        reject(new ApiError("Missing data or user ID", { "data" : data}));
        return; // Safety
      }

      // Creates the Session in the DB
      var queryStr = "INSERT INTO sessions (user_id, session_type, session_data) " +
                     "VALUES (${user_id}, ${session_type}, ${session_data})";

      var queryParams = {
        "user_id" : data.id,
        "session_type" : params.sessionType,
        "session_data" : data
      };

      console.log({ "queryStr" : queryStr, "params" : queryParams});

      // Now executes the Query
      me.query.none(queryStr, queryParams)
        // Now we retrieve the Session ID we just created
        .then(function(data) {
          console.log("Data Inserted Successfully. Now getting the Session ID");
          return Db.getUserSessions(queryParams.user_id,
            { "sessionType" : queryParams.session_type });
        })
        // Now returns the success to the caller
        .then(function(data) {
          // Checks we have a good array (needs 1 value)
          if (data.length !== 1) {
            reject(new ApiError("No Session ID returned",
              { "userID" : queryParams.user_id, "data" : data }));
            return;
          }
          // Let's return the session data
          resolve(data[0]);
          return; // Safety
        })
        // Error Catcher
        .catch(function(err) {
          // Report the Error
          console.log("ERROR: " + err);
          reject(new ApiError("Session Creation", { "err" : err }));
          return; // Safety
        })

    } catch (ex) {
      // Propagates the error to the original caller
      reject(new ApiError("Exception: " + ex, { "exception" : ex }));
    } // End of try { ... } catch () { ... }

  }) // End of Promise

};

// Returns a Promise for deleting a specific session
//
// Params:
//
// @sessionID - The Session ID of the session to delete
// @params - An object that determines the behavior of the deletion.
//           In particular, the checked properties are:
//
//           Currently Not Used
exports.delSession = function OCAdata$delSession(sessionID, params) {

  return new Promise(function OCAdata$delSession$Promise(resolve, reject) {

    // Use an exception catcher as Promises do not propagate
    // exceptions - therefore some error conditions might be
    // difficult to debug if the exception is not caught
    try {

      // Make sure we have an object in the 'params' parameter
      if (params == null) params = {};

      // Delete Session
      var delQuery = "DELETE FROM sessions ";
      var delQueryWhere = "WHERE id = ${sessionID} ";
      var delParams = { "sessionID" : sessionID };

      // Returns the Promise from the DB Driver
      me.query.none(delQuery + delQueryWhere, delParams)
         // This wrapper is needed so we can return the KaErr in the catch()
         .then(function (data) {
           // Returns null as there is not data that is Expected
           // to be returned
           resolve(data);
           return; // Safety
         })
         .catch(function(err) {
           // Returns a KaErr object that carries all the extra
           // information required for good Debugging
           reject(new ApiError("Error deleting Session",
             { "sessionID" : sessionID, "params" : params, "err": err }));
           return; // Safety
         })

    } catch (ex) {
      // Propagates the error to the original caller
      reject(new ApiError("Exception: " + ex,
        { "exception" : ex, "sessionID" : sessionID }));
    } // End of try { ... } catch () { ... }

  }); // End of Promise

};

// Returns a Promise for a specified SessionId
//
// Params:
//
// @sessionID - The Session ID should be the UUID for the session to retrieve
// @params - An object that determines the behavior of the deletion.
//           In particular, the checked properties are:
//
//           currently not used
exports.getSession = function OCAdata$getSession(sessionID, params) {

  // Returns the Promise
  return new Promise(function OCAdata$getSession$Promise(resolve, reject) {

    // Use an exception catcher as Promises do not propagate
    // exceptions - therefore some error conditions might be
    // difficult to debug if the exception is not caught
    try {

      // Input Checks
      if (typeof(sessionID) !== "string") {
        reject(new ApiError("Missing or wrong user param"),
          { "sessionID" : sessionID });
        return;
      } else if (params != null && typeof(params) !== "object") {
        reject(new ApiError("Wrong Params object", { "params" : params}));
        return;
      }

      // Container for the query parameters
      var queryParams = { "sessionID" : sessionID };

      // Base Query Data
      var getQuery = "SELECT * from sessions ";
      var getQueryWhere = "WHERE id = ${sessionID} ";

      // Performs the query and returns the returned information
      // as returned from the DB driver
      me.query.any(getQuery + getQueryWhere, queryParams)
        // Once we have the requested sessions, let's just
        // return it to the calling method
        .then(function(data) {
          // Propagate the returned data
          resolve(data);
          return; // Safety
        })
        .catch(function(err) {
          // Detected an error, let's propagate it
          reject(new ApiError("Error Querying DB",
            { "sessionID" : sessionID, "params" : params, "query" : getQuery, "err" : err }));
          return; // Safety
        });

    } catch (ex) {

      // Propagates the error to the original caller
      reject(new ApiError("Exception: " + ex,
        { "exception" : ex, "sessionID" : sessionID }));

    } // End of try { ... } catch () { ... }

  }); // End of Promise
};

exports.updateSession = function OCAdata$updateSession(sessionID, data, params) {

  // Returns the Promise
  return new Promise(function(resolve, reject) {
    // Not implemented, yet
    return reject(new ApiError("Not Implemented",
      { "func": this.name, "sessionID" : sessionID, "data" : data, "params" : params}));
  }); // End of Promise
};

// Returns a Promise after executing a generic DB query
//
// Params:
//
// @type     - Query type, one of 'none', 'one', or any
// @queryStr - Main Query String
// @whereStr - Where query clause (appended to queryStr)
// @params   - An object that determines the behavior of the deletion.
//             In particular, the checked properties are:
//
exports.queryData = function OCAdata$queryData(type, queryStr, whereStr, params) {

  // Returns the Promise
  return new Promise(function OCAdata$queryData$Promise(resolve, reject) {

    // Use an exception catcher as Promises do not propagate
    // exceptions - therefore some error conditions might be
    // difficult to debug if the exception is not caught
    try {

      // Make sure we have an object in the 'params' parameter
      if (params == null) params = {};

      // Input Checks
      if (typeof(queryStr) !== "string" || queryStr.length < 5) {
        throw "Missing or wrong query string";
      } else if (params != null && typeof(params) !== "object") {
        throw "Missing or wrong params";
      } else if (typeof type !== 'string') {
        throw "Missing query type";
      }

      // Checks the supported query Types (none, one, or any)
      switch (type) {

        // Recognized query types
        case "none" :
        case "one"  :
        case "any"  :
          break;

        // Rejects unknown types
        default : {
          throw "Query type (" + type + ") not recognized";
        }
      }

      // Returns the Promise from the DB Driver
      me.query[type](queryStr + " " + whereStr, params)
         // This wrapper is needed so we can return the KaErr in the catch()
         .then(function (data) {
           // Returns the retrieved data (if any)
           resolve(data);
           return; // Safety
         })
         .catch(function(err) {
           // Returns a KaErr object that carries all the extra
           // information required for good Debugging
           reject(new ApiError("Error while querying DB",
              { "type" : type, "queryStr" : queryStr + " " + whereStr, "params" : params, "err" : err }));
           return; // Safety
         })

    } catch (ex) {
      // Propagates the error to the original caller
      reject(new ApiError("Exception: " + ex,
        { "type" : type, "queryStr" : queryStr, "whereStr" : whereStr, "params" : params }));
    } // End of try { ... } catch () { ... }

  }); // End of new Promise()

};

exports.tests = function tests() {

  var sql = "select * from users where data @> '{ \"post\": \"me\" }'"

  // Executes the query
  query(sql, function(err, rows, result) {
    console.log(JSON.stringify(result));
  });

  // Tests
  var promise = query(sql);
  function onSuccess(rows, result) {
    // console.log(JSON.stringify(result));
  };
  function onError(error) {
    // console.log(JSON.stringify(error));
  };
  promise.spread(onSuccess, onError);

};
