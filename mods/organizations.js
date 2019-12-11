/*
 * Login Functions
 * Copyright (c) 2019 Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// This Object
var me = this;
var handlers = [];

// Shortcut
const getHandler = OCAtools.getHandler;

// Registers a new company
handlers.push({ method: "post", path: "/org", func: function (req, res) {
  console.log("Params: " + JSON.stringify(req.params));
  res.json({ "req" : req });
}});

// Approves a new company
handlers.push({ method: "get", path: "/org/:id/approve", func: function (req, res) {
  console.log("Params: " + JSON.strigify(req.params));
  res.json({ "req" : req });
}});

// enables a registered company
handlers.push({ method: "get", path: "/org/:id/enable", func: function (req, res) {
  console.log("Params: " + JSON.stringify(req.params));
  res.json({ "req" : req });
}});

// disables a registered company
handlers.push({ method: "get", path: "/org/:id/disable", func: function (req, res) {
  console.log("Params: " + JSON.stringify(req.params));
  res.json({ "req" : req });
}});

// lists registered organizations
handlers.push(
  getHandler({ method: "get", path: "/org", 
    func: function OCA$orgs$listOrgs(req, res, ctx) {

      // Local Variable for the list of organizations
      var orgList = [];

      // Cycle through the Organizations and generates a short list
      for (i in OCAcnf.orgs) {

        // Adds the details to the list
        orgList.push({ "id" : i,
                       "name" : OCAcnf.orgs[i].name,
                       "description" : OCAcnf.orgs[i].description });
      }

      // Generates a list of all companies and return it as a JSON array
      ctx.msg.body(orgList);

      // Sets the HTTP return code
      res.json(ctx.msg);
      return;
    }
  }, { login: false }, true)
);

// retrieves a specific organization
handlers.push(
  getHandler({ method: "get", path: "/org/:id",
    func: function (req, res, ctx) {

      // Local Shortcut
      var orgId = req.params.id;

      // Input Checking
      if (orgId == null || OCAcnf.orgs[orgId] == null) {
        ctx.msg.err(new OCAErr(-1, "Organization Id is Malformed"), req);
        res.status(500).res.json(ctx.msg);
        return;
      }

      // Gets a copy of the organization
      var org = OCAtools.deepCopy(OCAcnf.orgs[orgId]);

      // Sanitizes the info that is not needed
      delete org.users;
      delete org.isAdminOrg;

      // DEBUG
      console.log("Original Object:")
      console.dir(OCAcnf.orgs[orgId], 4, true);

      console.log("\nCloned Object:")
      console.dir(org, 4, true);

      // Sends the response
      res.json(org);
      return;

}}, { login: false }, true));

// updates the value of a specific company
handlers.push({ method: "put", path: "/org/:id", func: function (req, res) {
  console.log("Params: " + JSON.stringify(req.params));
  res.json({ "req" : req });
}});


// Exports only the handlers
exports.handlers = handlers;
