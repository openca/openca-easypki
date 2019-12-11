/*
 * Users Functions - Login, Logout, and Register
 * Copyright (c) 2016 Massimiliano Pala and Teza Realty
 * All Rights Reserved
 */

// This Object
var me = this;
var handlers = [];
var users = {};

// Shortcut
const getHandler = OCAtools.getHandler;

                        // ===========================================
                        // Login, Register, and Logout functionalities
                        // ===========================================

// Login
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/u/login/:org", func: function users$login (req, res, ctx) {

    console.log("DEBUG: REQ BODY", req.body);
    console.dir(req.body);

    // Checks the body
    if (!req.body || !req.body.uid || !req.body.creds) {
      ctx.msg.err(new OCAErr(-1, "Malformed request"));
      res.json(ctx.msg);
      return;
    }

    // Gets the Organization to Login into
    var org = req.params.org;

    // Gets the credentials
    var user = req.body.uid;
    var creds = req.body.creds;
    var userID = null;
    var isMobile = false;

    // // Checks for Mobile Devices
    // if (req.headers['user-agent'].search("Mobi") == true) {
    //   // Sets the Mobile Attribute
    //   isMobile = true;
    // } else {
    //   isMobile = false;
    // }

    // DEBUG
    console.log("[DEBUG::/u/login] User Agent: " + req.headers['user-agent'] + " - isMobile: " + isMobile);
    console.log("[DEBUG::/u/login] Login Start: user = " + user + ", creds = " + JSON.stringify(creds));

    // Input Check
    if (!user || !creds || !creds.type) {
      // Sets the error in the message
      ctx.msg.err(new OCAErr(-1, "Credentials format error"));
      // Sends the JSON message
      res.json(ctx.msg);
      // Exits the handler
      return;
    }

    // Gets the type of session (for now, we differentiate only between mobile
    // and non-mobile)
    // if (req.headers['user-agent'].search("Mobi") != -1) {
    //   isMobile = true;
    // }

    // Workflow to be implemented.
    // (a) Checks the Credentials for the user
    // (b) Deletes existing sessions (for the media)
    // (c) Creates a new Session
    // (d) Generates a new loginToken
    // (e) Encrypts the loginToken and saves it in the
    //     response via the appropriate login cookie
    OCAauth.checkCredentials(user, creds)
      // We need to remove existing session and create a new one in the
      // database (to prevent account sharing). We do allow to have a
      // mobile and non-mobile access at the same time (usability)
      .then(function(data) {
        // Debug
        console.log("[DEBUG::/u/login] Verified Creds: " + JSON.stringify(data));

        // Checks the result of the operation and returns an error
        // in case the credentials were not accepted
        if (data == null || data.validcreds != true || data.id == null) {
          // Debugging Information
          console.log("[DEBUG::/u/login] Error, Credentials not recognized");
          // Ignore the rest of the Promise chain
          return Promise.reject("rejected");
        }

        // Saves the returned UserID
        userID = data.id;

        // Logs the status
        console.log("[DEBUG::/u/login] Credentials for user " + user + " accepted");
        // Returns the promise from the DB module. Let's specify in the params
        // that we have a login username instead of a UUID
        return Db.delUserSessions(userID,
          { "sessionType" : ( isMobile == true ? "mobile" : "desktop") });
      })
      // After checking the credentials, we want to query for
      // all the main data connected to the user, in particular
      // let's query the 'people' data together with the user's
      // admin (if any) capabilities
      .then(function(data) {
        console.log("[DEBUG::/u/login] Existing Sessions for " + userID +
          " (mobile: " + isMobile + ") have been removed");
        console.log("[DEBUG::/u/login] Now Going to Query user's data");
        return Db.getUserData(userID);
      })
      // We now need to use the queried data to build the loginToken. Once
      // we have that, we encrypt it and return it to the user (successful
      // login) in the form of a cookie (that will be used in the checkAuth
      // method of the module ('lib/auth.js') to retrieve a good login
      .then(function(data) {
        console.log("[DEBUG::/u/login] Got User Data: " + JSON.stringify(data));
        console.log("[DEBUG::/u/login] Now we need to create a new session");
        return Db.newSession(data,
          { "sessionType" : ( isMobile == true ? "mobile" : "desktop") });
      })
      // Now we have created a successful entry in the DB for the session, we
      // can consider the login successful and return the success message to the
      // user (together with the next() link to the dashboard)
      .then(function(data) {
        console.log("[DEBUG::/u/login] data = " + JSON.stringify(data));
        // Checks the data to be sure we have a good session ID
        // note that the maxAge parameter is in milliseconds
        var encSessionId = Sec.encrypt(data.id);
        console.log("[DEBUG::/u/login] SessionsConfig = " + JSON.stringify(SessionsConfig));

        res.cookie(SessionsConfig.cookieName, encSessionId, {
          "maxAge": SessionsConfig.cookieMaxAge,
          "domain": SessionsConfig.cookieDomain,
          "httpOnly": true, // If false, Gives acesss to the cookie to the client-side JS
          "secure": true });
        // Sets a Body in the message
        ctx.msg.body({ "status" : "success"});
        // Sets the next in the links
        ctx.msg.next(Urls['dashboard']);
        // Returns the message to the caller
        res.json(ctx.msg);
        // TODO: Remove the Debug Statement
        console.log("[DEBUG::/u/login] All Done (" + JSON.stringify(ctx.msg) + ")");
        return; // Safety
      })
      .catch(function(err) {
        // Some logging
        console.log("[DEBUG::/u/login::catch()] Error, Credentials not recognized");
        // Credentials not valid
        ctx.msg.err(new OCAErr(-1,
          "Login failed, please check your credentials and try again."));
        ctx.msg.body({ "status" : "Credentials not valid"});
        // Sets the next URL to be the app base address
        ctx.msg.next(Urls['app']);
        // Sets the HTTP return code
        res.status(200).json(ctx.msg);
        return;
      }); // End of CheckCredentials Promise Chain

  } // End of getHandler() call

}, { login: false }, true));

// Logs Out
//
// AuthParams = { login: true }
handlers.push(
  getHandler({ method: "get",
               path: "/u/logout", func: function (req, res, ctx) {
    console.log("Params ( " + req.path + " ) : " + JSON.stringify(req.params));
    Db.delSession(ctx.sessionID)
    .then(function(data) {
      // Clears the Cookie
      res.clearCookie(SessionsConfig.cookieName);
      // Fills the MSG details
      ctx.msg.body({ status: "success" });
      ctx.msg.next(lib.urls['app']);
      res.status(200).header('Location', Urls['app']);
      // Returns the Message
      res.json(ctx.msg);
      console.log("[DEBUG::/u/logout] All Done (" + JSON.stringify(ctx.msg) + ")");
      return; // Safety
    })
    .catch(function(err) {
      ctx.msg.err(new OCAErr(-1, "Logout Error, Please Try Again"));
      ctx.msg.next(lib.urls['app']);
      res.status(200).header('Location', Urls['app']);
      // Returns the Message
      res.json(ctx.msg);
      console.log("[DEBUG::/u/logout] All Done (" + JSON.stringify(ctx.msg) + ")");
      return; // Safety
    })

}}, { login: false }, true));

// Registration
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/u/register", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: false }, false));

// Delete a new agent
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "get",
               path: "/u/:id/remove", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true }, false));

// Exports only the handlers
exports.handlers = handlers;

// Heartbeat
//
// AuthParams = { login: true }
handlers.push(
  getHandler({ method: "get",
               path: "/u/hb", func: function (req, res, ctx) {
    console.log("[DEBUG::/u/hb] Received HB")
    // Heartbeat Response Message
    ctx.msg.body({"status" : "ok"});
}}, { login: true }, false));

// Exports only the handlers
exports.handlers = handlers;
