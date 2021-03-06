//
//  © Copyright IBM Corporation 2017
//  LICENSE: MIT http://ibm.biz/license-non-ios
//

'use strict';

var appVars = require('../config/appVars');
var expressJwt = require('express-jwt');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');

var algorithm   = 'aes-256-gcm';

var validateJwt = expressJwt({secret: appVars.sessionSecret});

var securityHelper = {};

securityHelper.validateJwt = function (req, res, next) {
  validateJwt(req, res, next);
};

// Creates a token with the user id as payload
securityHelper.signToken = function(userId) {
    return jwt.sign(
        { id: userId },
        appVars.sessionSecret,
        { expiresIn: "6h" }); // the token will last for 6 hours
};

securityHelper.decodeToken = function(token, ignoreExpiration) {
    if(typeof(ignoreExpiration) ==='undefined') ignoreExpiration = false;
    return jwt.verify(token, appVars.sessionSecret, { json: true, ignoreExpiration: ignoreExpiration});
};

securityHelper.encrypt = function (text, key) {
    var iv = crypto.randomBytes(16);
    var cipher = crypto.createCipheriv(algorithm, key, iv);
    var encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    var tag = cipher.getAuthTag();

    return {
        text: encrypted,
        iv:  iv,
        tag: tag
    };
};

securityHelper.decrypt = function(encrypted, key, iv, tag) {
    var decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);
    var decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

module.exports = securityHelper;