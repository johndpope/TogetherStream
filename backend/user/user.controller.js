/**
 * Created by danielfirsht on 11/22/16.
 */

var pg = require('pg');
var appVars = require('../config/appVars');

var userController = {};

userController.registerUser = function(user) {
    return userController.saveUser(user);
};

userController.saveUser = function (user) {
    return new Promise(function (resolve, reject) {
        var client = new pg.Client(appVars.postgres.uri);
        client.connect();
        // Update users if exists, otherwise insert it
        // Warning: this is not safe if executed from multiple sessions at the same time
        client.query("UPDATE users SET id=$1 WHERE id = $2;", [user.id, user.id]);
        client.query("INSERT INTO users (id) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = $2);",  [user.id, user.id],
            function (err) {
                if (err) reject(err);

                resolve(user);

                client.end();
            }
        );
    });
};

userController.saveExternalAccount = function(userId, externalAccount) {
    return new Promise(function (resolve, reject) {
        var client = new pg.Client(appVars.postgres.uri);
        client.connect();
        // Update external account if exists with that provider, otherwise insert it
        // Warning: this is not safe if executed from multiple sessions at the same time
        client.query("UPDATE external_auth SET id=$1, access_token=$2, refresh_token=$3 WHERE user_id=$4 AND provider=$5;",
            [externalAccount.id, externalAccount.accessToken, externalAccount.refreshToken, userId, externalAccount.provider]);
        client.query("INSERT INTO external_auth (id, access_token, refresh_token, provider, user_id) SELECT $1, $2, $3, $4, $5"
            + "WHERE NOT EXISTS (SELECT 1 FROM external_auth WHERE user_id=$5 AND provider=$4);",
            [externalAccount.id, externalAccount.accessToken, externalAccount.refreshToken, externalAccount.provider, userId],
            function (err) {
                if (err) reject(err);

                resolve();

                client.end();
            }
        );
    });
};

userController.getUserByID = function (id) {
  return new Promise(function (resolve, reject) {
      var client = new pg.Client(appVars.postgres.uri);
      client.connect();
      // Get user info
      client.query("SELECT id FROM users WHERE id=$1", [id],
          function (err, result) {
              if (err) reject(err);
              if (result.rowCount < 1) {
                  resolve(null);
                  client.end();
              }
              else {
                  var user = {id: result.rows[0].id};
                  // Get external accounts
                  client.query("SELECT provider, access_token FROM external_auth WHERE user_id=$1", [id],
                      function (err, result) {
                          if (err) reject(err);
                          user.externalAccounts = result.rows;
                          resolve(user);

                          client.end();
                      });
              }
          }
      );
  })
};

userController.getUserIdByExternalAccount = function (externalAccount) {
  return new Promise(function (resolve, reject) {
      var client = new pg.Client(appVars.postgres.uri);
      client.connect();
      // Get user info
      client.query("SELECT user_id FROM external_auth WHERE id=$1 AND provider=$2", [externalAccount.id, externalAccount.provider],
          function (err, result) {
              if (err) reject(err);
              if (result.rowCount < 1) {
                  resolve(null);
              }
              else {
                  resolve(result.rows[0].user_id);
              }
              client.end();
          }
      );
  })
};

userController.processExternalAuthentication = function (req, externalAccount) {
    return new Promise(function (resolve, reject) {
        userController.getUserIdByExternalAccount(externalAccount)
            .then(function (userId) {
                if (userId) {
                    // External account is already linked to a user account
                    if (req.user) {
                        // Already logged in
                        if (req.user.id == userId) {
                            // External already linked, just return user
                            resolve(req.user);
                        }
                        else {
                            // TODO: uh oh, need to merge accounts
                        }
                    }
                    else {
                        // return the account that's linked
                        userController.getUserByID(userId)
                            .then(function (user) {
                                resolve(user);
                            });
                    }
                }
                else {
                    // External account is new
                    if (req.user) {
                        // already logged in, add external account
                        userController.saveExternalAccount(req.user.id, externalAccount)
                            .then(function () {
                                req.user.externalAccounts.push(externalAccount);
                                resolve(req.user);
                            });
                    }
                    else {
                        // create new account
                        generateId().then(function (id) {
                            userController.registerUser({id: id})
                                .then(function (user) {
                                    userController.saveExternalAccount(id, externalAccount)
                                        .then(function () {
                                            user.externalAccounts = [externalAccount];
                                            resolve(user);
                                        })
                                })
                        });
                    }
                }
            })
    })
};

function generateId() {
    return new Promise(function (resolve) {
        var generateAttempt = function () {
            var id = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            for( var i = 0; i < 10; i++ ) {
                id += possible.charAt(Math.floor(Math.random() * possible.length));
            }

            userController.getUserByID(id)
                .then(function (user) {
                    if(!user) {
                        resolve(id);
                    }
                    else {
                        generateAttempt();
                    }
                })
        };
        generateAttempt();
    });
}

module.exports = userController;