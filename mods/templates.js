/*
 * Langs Handler(s)
 * Copyright (c) 2016 Massimiliano Pala and Teza Realty
 * All Rights Reserved
 */

// This Object
var me = this;
var handlers = [];

const path = require('path');

// Auth Parameters
var params = { login: false };

// Shortcut to the getHandler method (w/ auth)
var getHandler = lib.tools.getHandler;

// Local Function
var getMetaData = function data$getExtension(fmt) {

  var ret = { "isError" : false };

  // Get Different File Handlerspa
  switch (fmt) {

    // CSS DataType
    case 'c' : {
      ret = { "ext" : "css", "encoding" : "utf-8", "contentType" : "text/css; charset=UTF-8" };
    } break;

    // HTML case
    case 'h' : {
      ret = { "ext" : "html", "encoding" : "utf-8", "contentType" : "text/html; charset=UTF-8" };
    } break;

    // JSON case
    case 'n' : {
      ret = { "ext" : "json", "encoding" : "utf-8", "contentType" : "application/json; charset=UTF-8" };
    } break;

    // JavaScript case
    case 's' : {
      ret = { "ext" : "js", "encoding" : "utf-8", "contentType" : "application/javascript; charset=UTF-8"};
    } break;

    // Images case
    case 'm' : {
      ret = { "ext" : "", "encoding" : "binary", "srcPath" : "media", "contentType" : "image/*"};
    } break;

    // Not Recognized Case
    default : {
      ret =  { "isError" : true };
    }
  }

  // Sets the 'isJSON' flag
  ret.isJSON = ( ret.ext == "json" ? true : false);

  // Returns the generated object
  return ret;
};

// Populates the handlers

// ===================================
// Public Handlers (no login required)
// ===================================

handlers.push(
  getHandler({ method: "get", 
               path: "/template/p/:name", func: function (req, res, ctx) {

    // Let's make sure we build the right resource name/path
    var fmt         = req.query['f'] || 'h'; // Defaults to html
    var name        = req.params['name'].replace("..","");

    // Checks required parameters
    if (!name || name.length < 3) {

      // Missing Parameter Error
      ctx.msg.err(new KaErr(-1, "missing parameter(s)"));

      // No further processing
      return res.json(ctx.msg);
    }

    // Gets the Metadata
    var metaData = getMetaData(fmt);

    // Checks for format error
    if (metaData.isError == true) {
      // Sets the error
      ctx.msg.err(new KaErr(-1, "format not supported", fmt));
      // Sends the JSON message
      res.json(ctx.msg);
      // All Done
      return;
    } 

    // Builds the Params for the data load/cache call
    var dataParams = { "name" : name, 
                       "fmt" : metaData.ext, 
                       "encoding" : metaData.encoding,
                       "isPublic" : true };

    // Gets the static JSON data (Asynchronous). 
    lib.tools.getStaticData(dataParams, function __get_pub_data(data, isCached) {

        // Cache control
        if (isCached != true) {
          res.header("Cache-Control", "no-cache, no-store, must-revalidate");
          res.header("Pragma", "no-cache");
          res.header("Expires", "0");
        }

        // First let's check for errors
        if (!data) {
          // Sets the appropriate error
          ctx.msg.err(new KaErr(-1, "no data found", { "name" : name, "f" : metaData.ext }));
          // Sends the error back
          return res.json(ctx.msg);
        };

        // Since the default does not set the charset in the content type
        // header, we explicitly set our own content type header
        res.header("Content-Type", metaData.contentType);

        // Sends the response. If JSON was requested, we return the
        // KaMSG wrapped value, otherwise, we just return the data
        // with the appropriate datatype
        if (metaData.ext == 'json') {
          // Set the JSON body
          ctx.msg.body(data);
          // Send the JSON
          res.json(ctx.msg);
        } else if (metaData.encoding == 'binary') {
          // Adds the Size
          res.header("Content-Length", data.length);
          // Send Binary Buffer
          res.end(new Buffer(data, 'binary'));
        } else {
          // Adds the Size
          res.header("Content-Length", data.length);
          // Not JSON - just send the data
          res.send(data);
  }

    });

}}, params, true));

// ====================================
// Private Handlers (login IS required)
// ====================================

handlers.push(
  getHandler({ method: "get", 
               path: "/template/u/:name", func: function (req, res, ctx) {

    // Let's make sure we build the right resource name/path
    var fmt         = req.query['f'] || 'h'; // Defaults to html
    var name        = req.params['name'].replace("..","");

    // Checks required parameters
    if (!name || name.length < 3) {

      // Missing Parameter Error
      ctx.msg.err(new KaErr(-1, "missing parameter(s)"));

      // No further processing
      return res.json(ctx.msg);
    }

    // Gets the Metadata
    var metaData = getMetaData(fmt);

    // Checks for format error
    if (metaData.isError == true) {
      // Sets the error
      ctx.msg.err(new KaErr(-1, "format not supported", fmt));
      // Sends the JSON message
      res.json(ctx.msg);
      // All Done
      return;
    } 

    // Builds the Params for the data load/cache call
    var dataParams = { "name" : name,
                       "encoding" : metaData.encoding,
                       "fmt" : metaData.ext,
                       "isPublic" : false 
                     };

    if (metaData.srcPath) dataParams.srcPath = metaData.srcPath;

    console.log("[DEBUG::/template/u/:name] CTX = " + JSON.stringify(ctx));

    // Gets the static JSON data (Asynchronous).
    lib.tools.getStaticData(dataParams, function __get_priv_data(data, isCached) {

        // Cache control
        if (isCached != true) {
          res.header("Cache-Control", "no-cache, no-store, must-revalidate");
          res.header("Pragma", "no-cache");
          res.header("Expires", "0");
        }

        // First let's check for errors
        if (!data) {
          // Sets the appropriate error
          ctx.msg.err(new KaErr(-1, "no data found", { "name" : name, "f" : metaData.ext }));
          // Sends the error back
          return res.json(ctx.msg);
        }

        // Since the default does not set the charset in the content type
        // header, we explicitly set our own content type header
        res.header("Content-Type", metaData.contentType);

        // Sends the response. If JSON was requested, we return the
        // KaMSG wrapped value, otherwise, we just return the data
        // with the appropriate datatype
        if (metaData.ext == 'json') {
          // JSON
          ctx.msg.body(data);
          res.json(ctx.msg);
        } else if (metaData.encoding == 'binary') {
          // Adds the Size
          res.header("Content-Length", data.length);
          // Send Binary Buffer
          res.end(new Buffer(data, 'binary'));
        } else {
          // Adds the Size
          res.header("Content-Length", data.length);
          // Not JSON - just send the data
          res.send(data);
        }

    });

}}, { login: true }, true));

// Exports only the handlers
exports.handlers = handlers;
