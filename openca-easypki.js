#! /usr/bin/env node
// =============================================================================
// OPENCA API - v0.0.1
// (c) 2019 by Massimiliano Pala and OpenCA Labs
// All Rights Reserved
// =============================================================================

// Global: Load Main Config and Package Info
OCAcnf = require(__dirname + "/conf/easypki_cnf");
OCApkg = require(__dirname + "/package");

// Some Banner Information
console.log("");
console.log("// %s - v%s", OCApkg.description, OCApkg.version);
console.log("// (C) 2019 by %s <%s>", OCApkg.author.name, OCApkg.author.email);
console.log("// All Rights Reserved\n");
console.log("[=== Begin Server Initialization: ===]\n");
console.log("* Server Initialization:");

// Global: Require Options
var reqOptions = {
  "recurse" : true,
  "extensions" : [ '.js', '.json' ], 
  "filter" : function (path) {
      return (path.match(/._.*/) ? false : true); }
  };

// Global: Library Modules
lib = require("require-dir")( __dirname + "/lib", reqOptions);

// Some Logging
console.log("  - Loaded local libraries ......: OK");

// Global: Modules Shortcut
OCAsec   = lib.sec;
OCAtools = lib.tools;
OCAauth  = lib.auth;
// OCAdata  = lib.data;

// Global: Engine Constructors
OCAEngine = require("./data/pub/js/OCAEngine.js")
OCAMsg = OCAEngine.OCAMsg;
OCAErr = OCAEngine.OCAErr;

// Error Object for API (e.g., rejected promises)
ApiError = OCAEngine.ApiError

// Global: Constant for OpenCA Base URL
BASE_URL = OCAcnf.baseUrl; // "https://www.openca.org";

// Global: Generic URLs
Urls = OCAcnf.urls;

// Prepends the URLs with the baseUrl
for (i in Urls) {
  Urls[i] = OCAcnf.baseUrl + Urls[i];
}

// Global: Session inactivity and lifetime (express in DB format)
SessionsConfig = {
  "maxInactivity" : OCAcnf.cookies.maxInactivity,
  "maxLifespan" : OCAcnf.cookies.maxLifespan,
  "cookieName"  : OCAcnf.cookies.name,
  "cookieDomain": OCAcnf.cookies.domain, // ".openca.org",
  "cookieMaxAge": OCAcnf.cookies.maxAge, // 1800000, // Expires in 30 mins
  "maxUpdateAge": OCAcnf.cookies.MaxUpdateAge, // 3600000  // Expires in 1 hour
};

// Initialize the Data Layer
// OCAdata.init(OCAcnf.data, OCAsec);

// Local: Packages
const Express      = require('express');        // call express
const BodyParser   = require('body-parser');
const CookieParser = require('cookie-parser');
const Promise      = require('bluebird');

// define our app using express
var app          = Express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(BodyParser.urlencoded({ extended: true }));
app.use(BodyParser.json());
app.use(CookieParser());

// Port Number
var port = OCAcnf.listen.port || process.env.PORT; // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = Express.Router();  // get an instance of the express Router

// REGISTER OUR ROUTES -------------------------------
if (OCAcnf.listen.pathPrefix != null) {
  // all of our routes will be prefixed with the version of the API
  app.use(OCAcnf.listen.pathPrefix, router);
  console.log("  - Setting pathPrefix ..........: %s", OCAcnf.listen.pathPrefix);
}

// test route to make sure everything is working
// (accessed at GET http://localhost:PORT/api)
router.get('/', function(req, res) {

  // Wrong Usage of the API, let's redirect somewhere else
  res.redirect("/");
});

// Routing Functions
var mods = require("require-dir")( __dirname + "/mods", reqOptions);

// Registers all the handlers
console.log("\n* Registered Modules (from 'mods/' dir):");

// Cycles through the mods and registers all the routes
// for each modulus that was deployed in the mods/ directory
for (var i in mods) {

  // If we have a viable handlers array, let's go through them and
  // register the handlers with the right paths
  if (mods[i] && mods[i].handlers != null) {
    // If the module has handlers, let's register the module
    OCAtools.registerHandlers(router, mods[i].handlers);
    console.log("  - " + i + " ... Ok");
  } else {
    // The module does not have valid handlers
    if (typeof(mods[i]) !== "function") console.log("  - " + i + " ... Skipped");
  }
}

//
// SETUP the default handler for exceptions
//
process.on("uncaughtException", function OCA$uncaughtExceptionHandler(ex) {
  console.log(new ApiError("Exception: " + ex,  { "Exception" : ex }));
})

// START THE SERVER
// =============================================================================
app.listen(port);

// All Done
console.log('\n* Services from \'%s\' are available on port %d\n', OCApkg.name, port);
console.log("[=== End Server Initialization: ===]\n");

// Server is listening
