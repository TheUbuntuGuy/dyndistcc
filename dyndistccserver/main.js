var http = require('http');
var fs = require('fs');
var url = require('url');
var db = require('./db');

var PORT = 33333;
var HTML_PATH = "html/";
var API_PATH = "api";

http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;
    var query = url.parse(request.url, true).query;

    //default page
    if (pathname == "/") {
        pathname = "/index.html";
    }

    var reqType = pathname.split("/")[1];

    if (reqType == API_PATH) {
        if (pathname.split("/").length < 3 || pathname.split("/")[2] == "") {
            console.log("Incomplete API request received");
            response.writeHead(404, {'Content-Type': 'text/plain'});
            response.write("#404: Incomplete API request\n");
            response.write("127.0.0.1\n");
            response.end();
            return;
        }

        var command = pathname.split("/")[2];
        console.log("API request received: %s", command);
        if (command == "checkin") {
            if (query.hash && query.project && query.name) {
                console.log("Checkin from " + query.hash);
                response.writeHead(200, {'Content-Type': 'text/plain'});
                //DEBUG
                //response.write("127.0.0.1 192.168.30.4\n");
                response.write(doCheckin(query.hash, query.project, query.name, request.connection.remoteAddress));

                response.end();
            } else {
                console.log("Bad checkin received");
                response.writeHead(404, {'Content-Type': 'text/plain'});
                response.write("#404: Bad checkin received\n");
                response.write("127.0.0.1\n");
                response.end();
                return;
            }
        }
    } else {
        //read the requested file
        fs.readFile(HTML_PATH + pathname.substr(1), function (err, data) {
            console.log("File request for " + HTML_PATH + pathname.substr(1) + " received");
            if (err) {
                console.log(err);

                response.writeHead(404, {'Content-Type': 'text/html'});
                response.write("404: File not found");
            } else {

                response.writeHead(200, {'Content-Type': 'text/html'});

                response.write(data.toString());
            }
            response.end();
        });
    }
}).listen(PORT);

function doCheckin(hash, project, name, ip) {
    var hosts = "127.0.0.1";
    var error = false;
    var date = new Date();
    var projectID;
    db.get("SELECT * FROM projects WHERE name=?", project, function (err, row) {
        if (err) {
            error = true;
            return;
        }
        if (typeof row == "undefined") {
            //project has not been setup on server
            error = true;
        } else {
            projectID = row.projectID;
        }
    });

    if (!error) {
        db.get("SELECT * FROM hosts INNER JOIN projects ON hosts.projectID=projects.projectID WHERE hash=?", hash, function (err, row) {
            if (err) {
                error = true;
                return;
            }
            if (typeof row == "undefined") {
                //host has never checked in
                db.run("INSERT INTO hosts (hash, ipAddr, projectID, ownerName, lastContact) VALUES(?, ?, ?, ?, ?)",
                        hash, ip, projectID, name, date.getTime(), function (err) {
                    if (err) {
                        error = true;
                    }
                });
            } else {
                db.run("UPDATE hosts SET lastContact=? WHERE hash=?",
                        date.getTime(), hash, function (err) {
                    if (err) {
                        error = true;
                    }
                });
            }
        });
    }

    if (!error) {
        db.all("SELECT ipAddr FROM hosts WHERE projectID=? AND lastContact>? AND hash!=?", projectID, (date.getTime() - 180000), hash, function (err, rows) {
            if (err) {
                error = true;
                return;
            }
            for (var i = 0; i < rows.length; i++) {
                hosts += " " + rows[i].ipAddr;
            }
        });
    }

    return hosts;
}

console.log('Server running at http://127.0.0.1:%s/', PORT);