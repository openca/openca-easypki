/*
 * OCAMsg and OCAErr Classes
 * (c) 21016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved
 */

// Constructor for OCAErr
function OCAErr(errno, desc, aux) {

  // Reference to itself
  var me      = this;
  var errData = undefined;

  // Sets the defaults
  me.__errno = -1;
  me.__desc  = null;
  me.__aux   = null;

  // If we only have one argument, let's check if that is the
  // value of internals of an existing or serialized OCAErr
  // If we got data in the string format let's check if we can parse the JSON
  // out of it
  if (arguments.length === 1) {

    try {
      if (typeof(errno) === "string") {
        errData = JSON.parse(errno);
      } else if (typeof(errno) === "object") {
        errData = errno;
      } else if (typeof(data) === "undefined") {
        // Nothing to do
      } else if (typeof(errno) === "number") {
        // Nothing to do
      } else {
        throw new ApiError("data (type) not supported (" + typeof(data) + ")");
      }
    }
    catch (e) {
      // Logs the Error and throw
      console.log("ERROR: Can not create a new OCAMsg");
      throw new ApiError("Exception: " + e, e);
    }

    // Analyzes the internal structure of the message and checks
    // if we have the right structure
    if (errData                 !=  null &&
        typeof(errData.__errno) !== "undefined" &&
        typeof(errData.__desc)  !== "undefined" &&
        typeof(errData.__aux)   !== "undefined") {

          // Assigns the internals
          me.__errno = errData.__errno;
          me.__desc  = errData.__desc;
          me.__aux   = errData.__aux;

          // Cleans up the first arguments
          errno = undefined;
    }
  }

  // Object's Internal Function
  me.setValue = function setValue(name, value) {
    // Input Checks
    if (typeof(name) !== "string") return;
    // Sets the value (if any was provided)
    if (value) me[name] = value;
    return me[name];
  }

  // Basic Properties
  if (errno != null) me.setValue("__errno", errno);
  if (desc != null) me.setValue("__desc", desc);
  if (aux != null) me.setValue("__aux", aux);

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

OCAErr.prototype.errno = function (value) {
  var me = this;
  return me.setValue("__errno", value);
}

OCAErr.prototype.desc = function (value) {
  var me = this;
  return me.setValue("__desc", value);
}

OCAErr.prototype.aux = function (value) {
  var me = this;
  return me.setValue("__aux", value);
}

/*
 * OCAMsg Class (JSON Message for OCAEngine)
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved
 */

// Constructor for OCAMsg
function OCAMsg(data) {

  // Reference to itself
  var me = this;
  var dataObj = undefined;
  var msgData = undefined;

  // MSG
  me.__msg = { links : { self: "", prev: "", next: "" }, err: null, body : null };

  // If we got data in the string format let's check if we can parse the JSON
  // out of it
  try {
    if (typeof(data) === "string") {
      dataObj = JSON.parse(data);
    } else if (typeof(data) === "object") {
      dataObj = data;
    } else if (typeof(data) === "undefined") {
      // Nothing to do
    } else {
      throw new ApiError("data (type) not supported (" + typeof(data) + ")");
    }
  }
  catch (e) {
    // Logs the Error and throw
    console.log("ERROR: Can not create a new OCAMsg");
    throw (e);
  }

  // Let's Check if we have body or a real message as input. If the second, we
  // just set the internal data of the message to the passed value
  if (typeof(dataObj)          !== "undefined" &&
      typeof(dataObj['__msg']) !== "undefined") {
    // Assigns the internals to the msgData to be inspected
    msgData = data['__msg'];
  } else {
    // Assigns the data directly to the msgData to be inspected
    msgData = data;
  }

  // Analyzes the internal structure of the message and checks
  // if we have the right structure
  if (msgData != null && msgData instanceof OCAMsg) {
    me.__msg = msgData;
    data = undefined;
  } else if (msgData           !=  null &&
      typeof(msgData['err'])   !== "undefined" &&
      typeof(msgData['links']) !== "undefined" &&
      typeof(msgData['body'])  !== "undefined") {
        // For the Err, we need to generate a new object and then
        // assign the internals accordingly
        me.__msg['err'] = new OCAErr(msgData.err);
        // Now let's set the body
        me.__msg['body'] = msgData.body;
        // Now let's set the links
        me.__msg['links'] = msgData.links;
        // Removes the 'data' parameters as it
        // has already been userId
        data = undefined;
  }

  // Analyzes the internal structure of the message and checks
  // if we have the right structure
  if (msgData && msgData instanceof OCAErr) {
    me.__msg['err'] = msgData;
    data = undefined;
  } else if (msgData                    !=  null &&
             typeof(msgData['__errno']) !== "undefined" &&
             typeof(msgData['__desk'])  !== "undefined" &&
             typeof(msgData['__aux'])   !== "undefined") {
    me.__msg['err'] = new OCAErr(msgData);
    data = undefined;
  }

  // Object's Internal Function. The expected arguments are
  // as follows:
  //
  // Case 1: only value is provided
  // @arg0 -> the specified section's value is returned
  //
  // Case 2: section and value are provided
  // @arg0 -> the section of the message (i.e. links, body, or err)
  // @arg1 -> the object containing the sub-section and value (e.g., for
  //   the links section, a valid object is  { prev : "..." }, while
  //   for the err section, a valid OCAErr object is required
  //
  // For the body section, no checks are performed (i.e., an object or a
  // string are good values)
  me.value = function value(section, value) {

    // Input Checks
    if (typeof(section) === "undefined" || section == null) return undefined;

    // Checks if the section exists
    if (typeof(me.__msg[section]) === "undefined") {
      throw("OCAMsg does not support section(" + section + ")");
    }

    // If no value is provided, let's return the requested section
    if (typeof(value) === "undefined") return me.__msg[section];

    // Checks for valid patterns
    switch(section) {
      case "body" :
        // Sets the value in message
        return me.__msg[section] = value;
        break;

      case "links" :
        // Data Checks
        for (var i in value) {
           if (typeof(me.__msg[section][i]) === "undefined") {
             throw ("Value name (" + i + ") for section (" + section + ") not supported!");
           }
        };
        // Sets the value in message
        for (var i in value) {
          if (value[i]) me.__msg[section][i] = value[i];
        }
        return me.__msg[section];
        break;

      case "err" :
        if (typeof(value) !== "object") {
          throw ("Error should be a OCAErr object");
        };
        return me.__msg[section] = value;
        break;

      default:
        throw("OCAMsg does not support section(" + section + ")");
    }
  }

  // Basic Properties
  if (data != null) me.value("body", data);

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

// Returns a copy of the MSG object
OCAMsg.prototype.get = function() { var copy = this.__msg; return copy; };

// Returns the MSG object in JSON format (stringified)
OCAMsg.prototype.getJSON = function() { return JSON.stringify(this.__msg); };

// Sets the "prev" property and returns the links section
OCAMsg.prototype.prev = function (value) {
  return this.value("links" , { "prev" : value }).prev;
}

// Sets the "self" property and returns the links section
OCAMsg.prototype.self = function (value) {
  return this.value("links" , { "self" : value }).self;
}

// Sets the "next" property and returns the links section
OCAMsg.prototype.next = function (value) {
  return this.value("links" , { "next" : value }).next;
}

// Sets and/or Returns the err object (if any) from the message
OCAMsg.prototype.err = function (value) {
  var value = this.value("err", value);

  // Checks if we have a value for the error
  if (value != null) {
    // If we have an empty error, let's just
    // return null
    if (value.errno() == -1   &&
        value.desc()  == null &&
        value.aux()   == null) {
      return null;
    }
  }

  // If we have a valid value, let's return it
  return value;
}

OCAMsg.prototype.clear = function() {
  this.__msg = { links : { self: "", prev: "", next: "" }, err: null, body : null };
}

// Sets and/or Returns the body object (if any) from the message
OCAMsg.prototype.body = function (value) {
  return this.value("body", value);
}

if (typeof(exports) !== "undefined") {
  exports.OCAMsg = OCAMsg;
  exports.OCAErr = OCAErr;
}


/*
 * ApiError Class
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved
 *
 * References:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
 */

// Constructor for Err
function ApiError(message, aux) {

  var me = this;

  // Sets the defaults
  this.name    = "ApiError";
  this.message = message || "Generic Error";
  this.stack = Error.captureStackTrace(this, this);
  this.aux     = aux;

  if (typeof(aux) === "object") {
    ApiError.prototype.dumpObject(aux);
  } else {
    console.trace(this.name + ": " + this.message +
      " (aux: " + JSON.stringify(this.aux) + ")");
  }

  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

ApiError.prototype.toString = function() {
  var ret = this.name + ": " + this.message + "\n" +
            this.stack + "\n" +
            (this.aux != null ? JSON.stringify(this.aux) : "");
  return ret;
};

ApiError.prototype.dumpObject = function(obj) {

  if (obj == null) obj = this.aux;

  console.log("=== DumpObject ===\n{ ");
  for (i in obj) {
    console.log("  " + i + " : " + obj[i] + ",");
  }
  console.log("}\n\n");
}

if (typeof(exports) !== "undefined") {
  exports.ApiError = ApiError;
}

