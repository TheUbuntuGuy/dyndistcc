/*
 * dyndistcc DB Manager
 * Copyright 2016 Mark Furneaux, Romaco Canada
 * 
 * This file is part of dyndistcc.
 * 
 * dyndistcc is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * dyndistcc is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with dyndistcc.  If not, see <http://www.gnu.org/licenses/>.
 */

var fs = require("fs");
var file = "dyndistcc.db";
var exists = fs.existsSync(file);

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(file);

var SW_VERSION = "0.0.1";
var DB_VERSION = 4;

db.serialize(function () {
    // Create the database on the first run
    if (!exists) {
        console.log("[SYS]  Creating DB...");
        db.run("CREATE TABLE dyndistcc (version TEXT, dbVersion INTEGER)");
        db.run("CREATE TABLE projects (projectID INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)");
        db.run("CREATE TABLE hosts (hostID INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "hash TEXT UNIQUE, ipAddr TEXT, projectID INTEGER, ownerName TEXT,"
                + "lastContact NUMERIC, swVersion TEXT, threads INTEGER)");

        db.run("INSERT INTO dyndistcc (version, dbVersion) VALUES (?, ?)", SW_VERSION, DB_VERSION);
    }
});

function checkDBVersion() {
    db.serialize(function () {
        db.get("SELECT * FROM dyndistcc", function (err, row) {
            if (err) {
                console.log("[ERROR]  Error checking DB version: " + err);
            }
            if (row.dbVersion < DB_VERSION) {
                console.log("[SYS]  DB must be upgraded from version " + row.dbVersion + " to " + DB_VERSION);
                doUpgradeDB(row.dbVersion);
            }
        });
    });
}

function doUpgradeDB(fromVers) {
    console.log("[SYS]  Upgrading DB...");
    // Intentional fall through for full incremental upgrade
    // Each case is the version the change was added in
    db.serialize(function () {
        switch (fromVers + 1) {
            case 1:
                db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 1, SW_VERSION);
            case 2:
                db.run("ALTER TABLE hosts ADD COLUMN hash TEXT");
                db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 2, SW_VERSION);
            case 3:
                db.run("ALTER TABLE hosts ADD COLUMN swVersion TEXT");
                db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 3, SW_VERSION);
            case 4:
                db.run("ALTER TABLE hosts ADD COLUMN threads INTEGER");
                db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 4, SW_VERSION);
        }
        console.log("[SYS]  DB upgraded successfully");
    });
}

function createProject(name, callback) {
    db.serialize(function () {
        db.run("INSERT INTO projects (name) VALUES (?)", name, function (err) {
            if (err) {
                console.log("[ERROR]  Error creating project. Does it already exist?");
                callback("fail");
            } else {
                console.log("[INFO]  Created project: \"" + name + "\"");
                callback("success");
            }
        });
    });
}

function deleteProject(name, callback) {
    db.serialize(function () {
        // Delete all hosts associated with the project first
        db.run("DELETE FROM hosts WHERE projectID IN (SELECT projectID FROM projects WHERE name=?)", name, function (err) {
            if (err) {
                console.log("[ERROR]  Error deleting project: " + err);
                callback("fail");
            } else {
                db.run("DELETE FROM projects WHERE name=?", name, function (err) {
                    if (err) {
                        console.log("[ERROR]  Error deleting project: " + err);
                        callback("fail");
                    } else {
                        console.log("[INFO]  Deleted project: \"" + name + "\"");
                        callback("success");
                    }
                });
            }
        });
    });
}

function deleteHost(hash, callback) {
    db.run("DELETE FROM hosts WHERE hash=?", hash, function (err) {
        if (err) {
            console.log("[ERROR]  Error deleting host: " + err);
            callback("fail");
        } else {
            console.log("[INFO]  Deleted host: \"" + hash + "\"");
            callback("success");
        }
    });
}

function doCheckin(hash, project, name, ip, swVersion, threads, callback) {
    // Always return localhost as the first host, even in an error scenario
    var hosts = "127.0.0.1/4";
    var date = new Date();

    db.serialize(function () {
        db.get("SELECT * FROM projects WHERE name=?", project, function (err, row) {
            // Project has not been setup on server
            if (err || typeof row == "undefined") {
                console.log("[WARN]  Checkin for undefined project: \"" + project + "\"");
                callback(hosts);
                return;
            }

            var projectID = row.projectID;

            db.get("SELECT * FROM hosts INNER JOIN projects ON hosts.projectID=projects.projectID WHERE hash=?", hash, function (err, row) {
                if (err) {
                    callback(hosts);
                    return;
                }
                if (typeof row == "undefined") {
                    // Host has never checked in
                    db.run("INSERT INTO hosts (hash, ipAddr, projectID, ownerName, lastContact, swVersion, threads) VALUES(?, ?, ?, ?, ?, ?, ?)",
                            hash, ip, projectID, name, date.getTime(), swVersion, threads, function (err) {
                        if (err) {
                            callback(hosts);
                        }
                        getHostList(projectID, hash, hosts, callback);
                    });
                } else {
                    db.run("UPDATE hosts SET lastContact=?, ipAddr=?, swVersion=?, threads=? WHERE hash=?",
                            date.getTime(), ip, swVersion, threads, hash, function (err) {
                        if (err) {
                            callback(hosts);
                        }
                        getHostList(projectID, hash, hosts, callback);
                    });
                }
            });
        });
    });
}

function getHostList(projectID, hash, hosts, callback) {
    var date = new Date();
    db.all("SELECT ipAddr, threads FROM hosts WHERE projectID=? AND lastContact>? AND hash!=?", projectID, (date.getTime() - 180000), hash, function (err, rows) {
        if (err) {
            callback(hosts);
            return;
        }
        var totalThreads = 0;
        for (var i = 0; i < rows.length; i++) {
            hosts += " " + rows[i].ipAddr + "/" + rows[i].threads;
            totalThreads += rows[i].threads;
        }
        console.log("[INFO]  Distributing " + totalThreads + " extra threads from " + rows.length + " node(s) to client " + hash);
        hosts += "\n";
        callback(hosts);
    });
}

function getProjectList(callback) {
    db.all("SELECT * FROM projects", function (err, rows) {
        if (err) {
            return;
        }
        callback(JSON.stringify(rows));
    });
}

function getAllHosts(callback) {
    db.all("SELECT * FROM hosts", function (err, rows) {
        if (err) {
            return;
        }
        callback(JSON.stringify(rows));
    });
}

checkDBVersion();

module.exports = {
    createProject: createProject,
    deleteProject: deleteProject,
    doCheckin: doCheckin,
    getProjectList: getProjectList,
    getAllHosts: getAllHosts,
    deleteHost: deleteHost,
    SW_VERSION: SW_VERSION,
    DB_VERSION: DB_VERSION
};