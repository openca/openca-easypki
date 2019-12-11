/*
 * Logging Auditing Functions
 * Copyright (c) 2019 Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// This Object
var me = this;
var handlers = [];
var users = {};

// Shortcut
var getHandler = lib.tools.getHandler;

                        // ===========================================
                        // Login, Register, and Logout functionalities
                        // ===========================================

// Suspends an agent for a specific time
handlers.push(
  getHandler({ method: "get",
      path: "/logs/:id/suspend/:days", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, roles : [ "agtadm" ] }, false));

// Revokes an agent access to the system
handlers.push(
  getHandler({ method: "get",
      path: "/logs/:id/archive", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, roles : [ "agent", "agtadm" ] }, false));

                        // =============================
                        // Basic Listing Functionalities
                        // =============================

// Returns the list of logs
handlers.push(
  getHandler({ method: "get",
      path: "/logs/:start/list", func: function (req, res, ctx) {
    console.log("Params (Query): " + JSON.stringify(req.query));
    res.json({ message: 'logs-get' });
}}, { login: true, roles : [ "agtadm" ] }, false));

// Returns a specific agent profile. This function uses the id parameter
// and responds to queries as follows:
//
//   https:// ... /api/logs/321
//
// where "321" is the "id" params (i.e., req.params => { "id" : "321" })
handlers.push(
  getHandler({ method: "get",
      path: "/logs/:id", func: function (req, res, ctx) {
    console.log("Params (Query): " + JSON.stringify(req.query));
    console.log("Params (Params): " + JSON.stringify(req.params));
    res.json({ message: 'logs-get' });   
}}, { login: true, roles : [ "agent", "agtadm" ] }, false));

// Exports only the handlers
exports.handlers = handlers;
