var fs = require("fs");
var file = "dyndistcc.db";
var exists = fs.existsSync(file);

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(file);

var SW_VERSION = "0.0.1";
var DB_VERSION = 2;

db.serialize(function () {
    if (!exists) {
        db.run("CREATE TABLE dyndistcc (version TEXT, dbVersion INTEGER)");
        db.run("CREATE TABLE projects (projectID INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)");
        db.run("CREATE TABLE hosts (hostID INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT UNIQUE, ipAddr TEXT, projectID INTEGER, ownerName TEXT, lastContact NUMERIC)");

        db.run("INSERT INTO dyndistcc (version, dbVersion) VALUES (?, ?)", SW_VERSION, DB_VERSION);
    }
});

function checkDBVersion() {
    db.get("SELECT * FROM dyndistcc", function (err, row) {
        if (err) {
            console.log(err);
        }
        if (row.dbVersion < DB_VERSION) {
            console.log("DB must be upgraded from version " + row.dbVersion + " to " + DB_VERSION);
            doUpgradeDB(row.dbVersion);
            console.log("DB upgraded successfully");
        }
    });
}

function doUpgradeDB(fromVers) {
    console.log("Upgrading DB...");
    //intentional fall through for full upgrade
    //each case is the version the change was added in
    switch (fromVers + 1) {
        case 1:
            db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 1, SW_VERSION);
        case 2:
            db.run("ALTER TABLE hosts ADD COLUMN hash TEXT");
            db.run("UPDATE dyndistcc SET dbVersion=?, version=? WHERE 1", 2, SW_VERSION);
    }
}

function createProject(name) {
    db.serialize(function () {
        db.run("INSERT INTO projects (name) VALUES (?)", name);
    });
}

checkDBVersion();

module.exports = {
    createProject: createProject
};