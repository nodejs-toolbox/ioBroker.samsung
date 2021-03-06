"use strict";

var utils = require(__dirname + '/lib/utils'),
    SamsungRemote = require('samsung-remote'),
    ping = require (__dirname + '/lib/ping'),
    Keys = require('./keys')
;

var nodeVersion4 = minNodeVersion('4.0.0');
if (nodeVersion4)  {
    var Samsung2016 = require (__dirname + '/lib/samsung-2016');
}

var remote, remote2016;
var powerOnOffState = 'Power.checkOnOff';

function isOn (callback) {
    ping.probe(adapter.config.ip, { timeout: 500 }, function(err, res) {
         callback (!err && res && res.alive);
    })
}

var nodeVersion;
function minNodeVersion (minVersion) {
    var re = /^v*([0-9]+)\.([0-9]+).([0-9]+)/;
    if (nodeVersion === undefined) {
        var nv = re.exec (process.version);
        nodeVersion = nv[1]*100*100 + nv[2] * 100 + nv[3];
    }
    var rv = re.exec(minVersion);
    var mv = rv[1] * 100*100 + rv[2]*100 + rv[3];
    return nodeVersion >= mv;
}

var checkOnOffTimer;
function checkPowerOnOff () {
    if (checkOnOffTimer) clearTimeout(checkOnOffTimer);
    var cnt = 0, lastOn;
    (function check() {
        isOn (function (on) {
            if (lastOn !== on) {
                if (on) adapter.setState (powerOnOffState, 'ON', true); // uppercase indicates final on state.
                adapter.setState (powerOnOffState, on ? 'on' : 'off', true);
                lastOn = on;
            }
            if (!on) {
                if (cnt < 10) checkOnOffTimer = setTimeout (check, 1000);
                else adapter.setState (powerOnOffState, 'OFF', true); // uppercase indicates final off state.
            }
        });
    })();
}

var adapter = utils.adapter({
    name: 'samsung',

    unload: function (callback) {
        try {
            callback();
        } catch (e) {
            callback();
        }
    },
    discover: function (callback) {
    },
    install: function (callback) {
    },
    uninstall: function (callback) {
    },
    objectChange: function (id, obj) {
    },

    stateChange: function (id, state) {

        if (state && !state.ack) {
            var as = id.split('.');
            if (as[0] + '.' + as[1] != adapter.namespace) return;
            switch (as[2]) {
                case 'command':
                    send (state.val, function callback (err) {
                        if (err) {
                        } else {
                        }
                    });
                    break;
    
                case 'Power':
                    switch (as[3]) {
                        // case 'powerOn':
                        //     send('KEY_POWERON');
                        //     return;
                        // case 'powerOff':
                        //     send('KEY_POWEROFF');
                        //     return;
                        case 'checkOnOff':
                        case 'checkOn':
                            checkPowerOnOff();
                            return;
                        default: // let fall through for others
                    }

                default:
                    adapter.getObject(id, function (err, obj) {
                        if (!err && obj) {
                            send(obj.native.command, function callback(err) {
                                if (!err) {
                                    adapter.setState(id, false, true);
                                }
                            });
                        }
                    });
                    break;
            }
        }
    },
    ready: function () {
        //g_devices.init(adapter, main);
        main();
    }
});

function send(command, callback) {
    if (!command) {
        adapter.log.error("Empty commands will not be excecuted.");
        return;
    }
    remote.send(command, callback || function nop () {});
}


function createObj(name, val, type, role) {
    
    if (role === undefined) role = type !== "channel" ? "button" : "";
    adapter.setObjectNotExists(name, {
        type: type,
        common: {
            name: name,
            type: 'boolean',
            role: role,
            def: false,
            read: true,
            write: true,
            values: [false, true]
        },
        native: { command: val }
    }, "", function (err, obj) {
        if (type !== "channel") adapter.setState(name, false, true);
    });
}

function main() {
    
    var commandValues = [];
    var channel;
    for (var key in Keys) {
        if (Keys[key] === null) {
            channel = key;
            createObj (key, "", "channel");
        }
        else {
            commandValues.push (key);
            createObj (channel + '.' + Keys[key], key, "state");
        }
    }
    createObj ('Power.checkOn', '', 'state', 'state');
    remote = new SamsungRemote ({ip: adapter.config.ip});
    
    if (nodeVersion4) {
        remote2016 = new Samsung2016 ({ip: adapter.config.ip, timeout: 2000});
        remote2016.onError = function (error) {
        }.bind (remote2016);
        remote2016.send (undefined, function (err, data) {
            if (err === 'success') {
                remote = remote2016;
            }
        });
    }

    adapter.setObjectNotExists('command', {
        type: 'state',
        common: {
            name: 'command',
            type: 'string',
            role: 'state',
            desc: "KEY_xxx",
            values: commandValues,
            states: commandValues
        },
        native: {}
    }, "", function (err, obj) {
        adapter.setState("command", "", true/*{ ack: true }*/);
    });
    adapter.setObjectNotExists(powerOnOffState, {
        type: 'state',
        common: {
            name: 'Teterminates Power state',
            type: 'string',
            role: 'state',
            desc: "checks if powered or not. Can be set to any value (ack=false). If ack becomes true, val holds the status"
        },
        native: {}
    }, "", function (err, obj) {
        adapter.setState(powerOnOffState, "", true/*{ ack: true }*/);
    });
    checkPowerOnOff();
    adapter.subscribeStates('*');
}
