// Initialization
var sec = this;
var crypto = require('crypto');

// Defaults
var algs = {
  0: { id: 'aes-128-cbc', iv: 16, tag: 0, size: 16 },
  1: { id: 'aes-256-cbc', iv: 16, tag: 0, size: 32 },
  2: { id: 'aes-128-gcm', iv: 12, tag: 8, size: 16 },
  3: { id: 'aes-256-gcm', iv: 12, tag: 16, size: 32 }
};

// Local Scoped Variables
var keys          = null;
var keySecret     = null;
var keySalt       = null;
var hmacSecret    = null;
var sessionSecret = null;

// Local Defauts
var DEF_ALG       = 2;
var DEF_HMAC_ALG  = 'sha256';

// Sets the Initial values
sec.isInitialized = false;

// Key Facility
var keys = {

  kidsArray: [],

  new: function new_key(secret, salt,size) {
         var val = crypto.pbkdf2Sync(secret, salt, 100000, size, 'sha256');
         var kid = crypto.createHash('sha256').update(val).digest('base64');

         // Gets the Key Object
         var key = { "kid": kid, "val": val };

         // Let's add it to the object
         this[kid]  = key;
         this[size] = key;
  }
};

//
// Functions to export
//

// init( { config }) - Initializes the Security Module via the
//                     config object passed as the argument
// @config - JSON object with the following properties:
//           keySeed, hmacSeed, seessionSeed

exports.init = function OCASec$init(config) {

  // Input Checks
  if (config == null) return new ApiError("Missing OCAcnf Object");

  // Initial Secrets for Encryption
  keySecret = crypto.createHash('sha512')
              .update(config.keySeed)
              .update('09h$#$er034h3!@!3j0f9klnSDFSJ4o43581-213jf;')
              .digest('binary');

  keySalt   = crypto.createHash('sha512')
              .update(keySecret)
              .digest('binary');

  hmacSecret = crypto.createHash('sha256')
               .update(config.hmacSeed)
               .update('90bhvew984!;l/;p:{}":#@$"lok')
               .digest('binary');

  sessionSecret = crypto.createHash('sha256')
                  .update(config.sessionSeed)
                  .update('DFU034Oujgsf90823!@:MCOGJThe#:#@!MLDdifja4')
                  .digest('binary');

  // Generate a new Key
  keys.new(keySecret, keySalt, 16);
  keys.new(keySecret, keySalt, 32);

  // All Done
  sec.isInitialized = true;
  return sec.isInitialized;  
};

// isInitialized() - Returns the status of the Security Module
//
// Returns 'true' if the module has been initialized, 'false'
// otherwise

exports.isInitialized = function OCAsec$isInitialized() {
  // Returns the internal value
  return sec.isInitialized;
};


// hmac( data, hmacValue ) - Calculates or verify an hmacValue
//
// data - Data to calculate (or verify) the hmac over
// hmacValue - The 'base64' representation of the hmacValue
//             to be verified (if supplied). If a new hmac
//             calculation is required, pass 'null' as the
//             hmacValue
//
// If no hmacValue was provided, the function returns the
// 'base64' representation of the hmac calculated over the
// data value. If hmacValue is provided, the returned value
// is a boolean: 'true' if the hmacValue is the same as the
// calculated one (over the 'data' value), 'false' in case
// the two values do not match.
exports.hmac = function OCAsec$hmac(data, seed, fmt) {

  // Input check
  if (!seed) seed = hmacSecret;
  if (!fmt) fmt = 'base64';

  // Initializes the variable
  var hmac = crypto.createHmac(DEF_HMAC_ALG, seed);
  
  // Returns the value of the calculated hmac
  return hmac.update(data).digest(fmt);
};

// verifyHmac( data, hmacValue) - Verifies that the hmac value
//   calculated over the @data is the same as the passed value
//   in the @hmacValue parameter. The function returns 'true'
//   if the hmac verifies successfully or 'false' if the hmac
//   calculated over the @data and the @hmacValue do not match.
//   The function throws an exception if @data or @hmacValue
//   are null
exports.verifyHmac = function OCAsec$verifyHmac(data, hmacValue, seed, fmt) {

  // Input Checks
  if (data == null || hmacValue == null) {

    // If we do not have the needed data, let's throw
    throw new ApiError(
       "Both Data [%s] and hmacValue [%s] are required!",
       typeof(data), typeof(hmacValue));
  }

  // If we do not have an explicit seed, use the default one
  if (!seed) seed = hmacSecret;
  if (!fmt) fmt = 'base64';

  // Builds a new hmac and calculated it by using the right seed
  var hmac = crypto.createHmac(DEF_HMAC_ALG, seed);

  // Returns the validation of the calculated and passed digests
  return hmacValue == hmac.update(data).digest(fmt);
}

// encrypt( data, algor ) - Encrypts the passed data by using
//   the passed algorithm (see the algs variable above)
exports.encrypt = function OCASec$ecrypt_sym(data, algor) {

  var iv  = null;
  var tag = null;
  var key = null;
  var dat = null;

  // Enc Array Structure:
  // [0] Key Identifier
  // [1] Algorithm Identifier
  // [2] Initialization Vector
  // [3] Encrypted Data
  // [4] Authentication Tag
  var enc = [];

  // Gets the default algorithm
  if (algor == null) algor = DEF_ALG;

  // Verifies that the algorithm is supported
  if (algs[algor] == null) {
    throw "algor ${algor} not supported!";
  }

  // Generates the new IV
  iv = crypto.randomBytes(algs[algor].iv);


  // Select the right key based on size
  key = keys[algs[algor].size];
  var cipher = crypto.createCipheriv(algs[algor].id, key.val, iv);

  // Push The Key Identifier + Algor + IV
  enc.push(key.kid);
  enc.push(algor);
  enc.push(iv.toString('base64'))

  // Push the Encrypted Data
  enc.push(cipher.update(data, 'utf8', 'base64') + cipher.final('base64'));

  // If GCM is used, let's get the Auth Tag and push that too
  if (algs[algor].tag > 0) {
    enc.push(cipher.getAuthTag().toString('base64'))
  }

  // Let's create a new Buffer and B64 encode the data
  var buf = new Buffer(JSON.stringify(enc));
  return buf.toString('base64');
};

exports.decrypt = function OCASec$decrypt_sym(data) {

  // Encoded data object
  var enc = null;

  // Decipher object
  var dec = null;

  // Can not decrypt null
  if (data == null) return null;

  // Parse the array
  enc = JSON.parse((new Buffer(data, 'base64').toString('utf8')));
  if (enc == null || enc.length < 3) return null;

  // Creates a Decryption Object
  dec = crypto.createDecipheriv(algs[enc[1]].id, keys[enc[0]].val, 
        new Buffer(enc[2], 'base64'));

  if (algs[enc[1]].tag > 0) {
    // Sets the TAG here
    dec.setAuthTag(new Buffer(enc[4], 'base64'));
  };

  // Returns the decoded data
  return dec.update(enc[3], 'base64', 'utf8') + dec.final('utf8');
};

exports.encryptObj = function $OCAsec$encrypt_sym_obj(obj, algor) {
  var data = null;

  if (obj == null || typeof obj != 'object') {
    throw "A valid object is required.";
  }

  return sec.encrypt(JSON.stringify(obj), algor);
};

exports.decryptObj = function OCASec$decrypt_sym_obj(data) {
  var stringy = sec.decrypt(data);

  return JSON.parse(stringy);
};

exports.getHmacAlgorithm = function OCAsec$getHmacAlgorithm() {
  return DEF_HMAC_ALG;
};

exports.setHmacAlgorithm = function OCAsec$setHmacAlgorithm(algor) {
  // Input check
  switch (algor) {
    case "sha512":
    case "sha384":
    case "sha256":
    case "sha1":
	break;

    default:
      throw new ApiError("Algorithm [" + algor + "] is not supported for hmac calculations.")
  }

  // Assigns the value
  DEF_HMAC_ALG = algor;

  // All Done
  return true;
};

exports.randBytes = function OCASec$getRandBytes(size, fmt) {

  // Default format
  if (fmt == null) fmt = 'hex';

  // Returns some random bytes in the passed format (default is hex)
  return crypto.randomBytes(size).toString(fmt);
};

exports.getAlgorDescById = function OCA$getAlgorDescById(id) {
  // Returns the Algorithm description
  return ( algs[id] != null ? algs[id].id : null);
};

exports.getAlgorDesc = function OCA$getAlgorDesc(data) {

  // Parse the array
  var enc = JSON.parse((new Buffer(data, 'base64').toString('utf8')));
  if (enc == null || enc.length < 3) return null;

  // Returns the description
  return sec.getAlgorDescById(enc[1]);
};

exports.tests = function OCAsec$tests() {

  // Number of Iteractions
  var iter = 100000;

  // Generic data to use for the tests
  var data = "8932ufuhpurfhp93q4bep9vy394ghv98y";

  var data32 = sec.randBytes(32, 'binary');
  var data64 = sec.randBytes(64, 'binary');
  var data128 = sec.randBytes(128, 'binary');
  var data256 = sec.randBytes(256, 'binary');

  function __exec_hmac_tests(testAlgor, data) {

    // Saves the original algorithm
    var oldAlgor = sec.getHmacAlgorithm();

    // Signature and Start Date
    var sig = null;
    var start = new Date();

    // Sets the algorithm to the test one and calculates the hmac
    sec.setHmacAlgorithm(testAlgor);
    for (i = 0; i < iter; i++) {
      sig = sec.hmac(data);
    }
    console.log("  - [ Alg: " + sec.getHmacAlgorithm() + ", Data: " + data.length + "] Signing Time ... " + 
      (new Date() - start) + "ms");

    var start = new Date();
    for (i = 0; i < iter; i++) {
      if (sec.verifyHmac(data, sig) != true) throw "Error while verifying hmac!";
    }
    console.log("  - [ Alg: " + sec.getHmacAlgorithm() + ", Data: " + data.length + "] Verifying Time ... " + 
      (new Date() - start) + "ms");

    // Resets to the original algorithm
    sec.setHmacAlgorithm(oldAlgor);
  }

  // ===========
  // HMAC Tests
  // ===========

  console.log("\nHmac Tests (" + iter + " sig):");

  var testAlgos = [ "sha1", "sha256", "sha384", "sha512" ];
  var testData = [ data32, data64, data128, data256 ];

  for (var algNum = 0; algNum < testAlgos.length; algNum++) {
    for (var dataNum = 0; dataNum < testData.length; dataNum++) {
      __exec_hmac_tests(testAlgos[algNum], testData[dataNum]);
    }
  }

  //
  // Encryption tests
  //
  console.log("\n* Encryption Tests (" + iter + " enc):");

  // Encryption: Algorithms
  for (var alg = 0; alg < 4; alg++) {
    // Encryption: Data
    for (var dataNum = 0; dataNum < testData.length ; dataNum++) {
      // Start Time
      var start = new Date();
      // Encrypt 'iter' times
      for (i = 0; i < iter; i++) {
        sec.encrypt(testData[dataNum], alg);
      }
      // Logs the results
      console.log("  - [ Alg: " + sec.getAlgorDescById(alg) + 
        ", Data: " + testData[dataNum].length + "] Elapsed Time ... " + (new Date() - start) + "ms");
    }
  }

  //
  // Decription tests
  //
  console.log("\n* Decryption Tests (" + iter + " dec):");

  // Decryption: Algorithms
  for (var alg = 0; alg < 4; alg++) {
    // Builds the ecrypted data array
    var encData = [];

    // Encrypts the data once with the set algorithm
    for (var dataNum = 0; dataNum < testData.length ; dataNum++) {
	encData.push(sec.encrypt(testData[dataNum], alg));
    }

    // Start Time
    var start = new Date();

    // Decryption: Data
    for (var encNum = 0; encNum < encData.length ; encNum++) {
      // Decryption: Iter
      for (i = 0; i < iter; i++) {
        sec.decrypt(encData[encNum]);
      }
      console.log("  - [" + sec.getAlgorDescById(alg) + 
        ", Data: " + encData[encNum].length + "] Elapsed Time ... " + (new Date() - start) + "ms");
    }
  }

  return;
}

return;

