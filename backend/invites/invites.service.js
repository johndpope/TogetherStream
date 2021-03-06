//
//  © Copyright IBM Corporation 2017
//  LICENSE: MIT http://ibm.biz/license-non-ios
//

var apn = require('apn');
var userController = require('../user/user.controller');
var appVars = require('../config/appVars');

var invitesService = {};

invitesService.processSendingInvites = function (req, res) {
    userController.getOrCreateStream(req)
        .then(function (stream) {
            var users = req.body['users'];
            for(var i = 0; i < users.length; i++) {
                userController.getUserAccountByExternalAccount({id: users[i], provider: 'facebook-token'})
                    .then(function (user) {
                        saveInvite(user, stream);

                        if (user.deviceToken != undefined) {
                            sendNotification(user, req);
                        }
                        else {
                            userController.getUserByID(user.id)
                                .then(function (fullUser) {
                                    sendEmail(fullUser, req);
                                });
                        }

                    });
            }
        });

    res.sendStatus(200);
};

invitesService.retrieveInvites = function (req, res) {
    getInvites(req.user)
        .then(function (invites) {
            res.json(invites)
        })
};

invitesService.deleteInvites = function (req, res) {
    deleteInvites(req.user);

    res.sendStatus(200);
};

var sendNotification = function (user, req) {
    var note = new apn.Notification();
    note.badge = req.body["currentBadgeCount"] + 1;
    note.sound = "ping.aiff";
    note.alert = "You've been invited to join a stream by " + req.body["host"] + "!";
    note.payload = {
        user_id: req.user.id,
        csync_path: req.body["streamPath"],
        stream_name: req.body["streamName"],
        description: req.body["streamDescription"],
        external_accounts: {}
    };
    note.topic = 'com.ibm.cloud.stormtrooper';

    var externalAccounts = req.user.externalAccounts;
    for (var i = 0; i < externalAccounts.length; ++i) {
        note.payload.external_accounts[externalAccounts[i].provider] = externalAccounts[i].id;
    }

    var apnProvider = appVars.apn;
    apnProvider.send(note, user.deviceToken).then(function (result) {
        console.log(result);
    })
};

var sendEmail = function (participant, req) {
    var participantAccessToken = userController.getExternalAccountAccessToken(participant, 'facebook-token');
    var request = require('request');
    request('https://graph.facebook.com/v2.8/me' + '?fields=email&access_token=' + participantAccessToken, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var streamId = req.body['streamPath'].split('.').pop();
            var jsonBody = JSON.parse(body);
            var mailOptions = {
                from: '"Together Stream" <' + appVars.mail.userName + '@' + appVars.mail.domainName + '>', // sender address
                to: jsonBody.email,
                subject: 'New Stream Invite from ' +  req.body['host'], // Subject line
                text:  'Howdy!\n\n' + req.body['host'] + ' is streaming videos on Together Stream (like right now). ' +
                'Come watch together in real time! \uD83D\uDC6F \n\n' + 'Download the iOS app or use this code to join on web: ' +
                + streamId + '\n\nhttp://togetherstream.csync.io/app?stream_id=' + streamId
            };
            appVars.mail.transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    return console.error(error);
                }
                console.log('Message sent: ' + info.response);
            });
        }
    });

};

var saveInvite = function (user, stream) {
    return new Promise(function (resolve, reject) {
        var pool = appVars.pool;
        pool.connect(function (err, client, done) {
            if(err) {
                return console.error('error fetching client from pool', err);
            }
            client.query("INSERT INTO stream_invites (stream_id, user_id) SELECT $1, $2", [stream.id, user.id],
                function (err, result) {
                    done(err);
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(null);
                    }
                }
            );
        });
    })
};

var getInvites = function (user) {
    return new Promise(function (resolve, reject) {
        var pool = appVars.pool;
        pool.connect(function (err, client, done) {
            if (err) {
                return console.error('error fetching client from pool', err);
            }
            client.query("SELECT streams.user_id, streams.csync_path, streams.stream_name, streams.description, external_auth.id, external_auth.provider " +
                "FROM streams INNER JOIN stream_invites ON streams.id = stream_invites.stream_id " +
                "INNER JOIN external_auth ON streams.user_id = external_auth.user_id " +
                "WHERE (stream_invites.user_id = $1 AND external_auth.user_id = streams.user_id)", [user.id],
                function (err, result) {
                    done(err);
                    if (err) {
                        reject(err);
                    }
                    else {
                        var results = result.rows;
                        if (results.length == 0) {
                            resolve(results);
                        }
                        else {
                            // flatten external accounts into invites
                            var invites = {};

                            for (var i = 0; i < results.length; i++) {
                                var userId = results[i].user_id;
                                if (invites[userId] == null) {
                                    invites[userId] = results[i];
                                    invites[userId].external_accounts = {};
                                    invites[userId].external_accounts[results[i].provider] = results[i].id;
                                    // clear properties that have been moved to external_accounts
                                    delete invites[userId].id;
                                    delete invites[userId].provider;
                                }
                                else {
                                    invites[userId].external_accounts[results[i].provider] = results[i].id;
                                }
                            }
                            var flattenedInvites = [];
                            for (var invite in invites) {
                                flattenedInvites.push(invites[invite])
                            }
                            resolve(flattenedInvites);
                        }
                    }
                }
            );
        });
    })
};

var deleteInvites = function (user) {
    return new Promise(function (resolve, reject) {
        var pool = appVars.pool;
        pool.connect(function (err, client, done) {
            if (err) {
                return console.error('error fetching client from pool', err);
            }
            client.query("DELETE FROM streams WHERE user_id = $1", [user.id],
                function (err, result) {
                    done(err);
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                }
            );
        });
    })
};

module.exports = invitesService;