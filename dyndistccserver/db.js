var fs = require("fs");
var file = "dyndistcc.db";
var exists = fs.existsSync(file);

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(file);

var SW_VERSION = "0.0.1";
var DB_VERSION = 2;

db.serialize(function () {
    if (!exists) {
        console.log("Creating DB...");
        db.run("CREATE TABLE dyndistcc (version TEXT, dbVersion INTEGER)");
        db.run("CREATE TABLE projects (projectID INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)");
        db.run("CREATE TABLE hosts (hostID INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT UNIQUE, ipAddr TEXT, projectID INTEGER, ownerName TEXT, lastContact NUMERIC)");

        db.run("INSERT INTO dyndistcc (version, dbVersion) VALUES (?, ?)", SW_VERSION, DB_VERSION);
    }
});

function checkDBVersion() {
    db.serialize(function () {
        db.get("SELECT * FROM dyndistcc", function (err, row) {
            if (err) {
                console.log(err);
            }
            if (row.dbVersion < DB_VERSION) {
                console.log("DB must be upgraded from version " + row.dbVersion + " to " + DB_VERSION);
                doUpgradeDB(row.dbVersion);
            }
        });
    });
}

function doUpgradeDB(fromVers) {
    console.log("Upgrading DB...");
    //intentional fall through for full upgrade
    //each case is the version the change was added in
    db.serialize(function () {
        switch (fromVers + 1) {
            case 1:
                db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 1, SW_VERSION);
            case 2:
                db.run("ALTER TABLE hosts ADD COLUMN hash TEXT");
                db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 2, SW_VERSION);
        }
        console.log("DB upgraded successfully");
    });
}

function createProject(name, callback) {
    db.serialize(function () {
        db.run("INSERT INTO projects (name) VALUES (?)", name, function (err) {
            if (err) {
                console.log("Error creating project. Does it already exist?");
                callback("fail");
            } else {
                console.log("Created project: \"" + name + "\"");
                callback("success");
            }
        });
    });
}

function deleteProject(name, callback) {
    db.serialize(function () {
        db.run("DELETE FROM hosts WHERE projectID IN (SELECT projectID FROM projects WHERE name=?)", name, function (err) {
            if (err) {
                console.log("Error deleting project: " + err);
                callback("fail");
            } else {
                db.run("DELETE FROM projects WHERE name=?", name, function (err) {
                    if (err) {
                        console.log("Error deleting project: " + err);
                        callback("fail");
                    } else {
                        console.log("Deleted project: \"" + name + "\"");
                        callback("success");
                    }
                });
            }
        });
    });
}

function doCheckin(hash, project, name, ip, callback) {
    var hosts = "127.0.0.1";
    var date = new Date();

    db.serialize(function () {
        db.get("SELECT * FROM projects WHERE name=?", project, function (err, row) {
            //project has not been setup on server
            if (err || typeof row == "undefined") {
                console.log("Checkin for undefined project: \"" + project + "\"");
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
                    //host has never checked in
                    db.run("INSERT INTO hosts (hash, ipAddr, projectID, ownerName, lastContact) VALUES(?, ?, ?, ?, ?)",
                            hash, ip, projectID, name, date.getTime(), function (err) {
                        if (err) {
                            callback(hosts);
                        }
                        getHostList(projectID, hash, hosts, callback);
                    });
                } else {
                    db.run("UPDATE hosts SET lastContact=?, ipAddr=? WHERE hash=?",
                            date.getTime(), ip, hash, function (err) {
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
    db.all("SELECT ipAddr FROM hosts WHERE projectID=? AND lastContact>? AND hash!=?", projectID, (date.getTime() - 180000), hash, function (err, rows) {
        if (err) {
            callback(hosts);
            return;
        }
        console.log("Distributing " + rows.length + " nodes");
        for (var i = 0; i < rows.length; i++) {
            hosts += " " + rows[i].ipAddr;
        }
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
    SW_VERSION: SW_VERSION,
    DB_VERSION: DB_VERSION
};