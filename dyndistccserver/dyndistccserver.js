/*
 * dyndistcc HTTP Server
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

    // Default landing page
    if (pathname == "/") {
        pathname = "/index.html";
    }

    var reqType = pathname.split("/")[1];

    if (reqType == API_PATH) {
        if (pathname.split("/").length < 3 || pathname.split("/")[2] == "") {
            console.log("[ERROR]  Incomplete API request received");
            response.writeHead(400, {'Content-Type': 'text/plain'});
            response.write("HTTP 400: Incomplete API request\n");
            response.end();
            return;
        }

        var command = pathname.split("/")[2];
        console.log("[INFO]  API request received: %s", command);
        if (command == "checkin") {
            if (query.hash && query.project && query.username && query.swVersion && query.threads) {
                console.log("[INFO]  Checkin from " + query.hash);
                
                //do not accept checkins from localhost, as they will cause problems
                if (request.connection.remoteAddress == "127.0.0.1") {
                    console.log("[WARN]  Checkins from localhost are not supported. Use the public IP address instead");
                    returnError(response);
                }
                
                db.doCheckin(query.hash, query.project, query.username, request.connection.remoteAddress, query.swVersion, query.threads, function (hosts) {
                    response.writeHead(200, {'Content-Type': 'text/plain'});
                    response.write(hosts);
                    response.end();
                });
            } else {
                returnError(response);
                return;
            }
        } else if (command == "createProject") {
            if (query.name) {
                db.createProject(query.name, function (status) {
                    response.writeHead(200, {'Content-Type': 'text/plain'});
                    response.write(status);
                    response.end();
                });
            } else {
                returnError(response);
                return;
            }
        } else if (command == "deleteProject") {
            if (query.name) {
                db.deleteProject(query.name, function (status) {
                    response.writeHead(200, {'Content-Type': 'text/plain'});
                    response.write(status);
                    response.end();
                });
            } else {
                returnError(response);
                return;
            }
        } else if (command == "getProjectList") {
            db.getProjectList(function (rows) {
                response.writeHead(200, {'Content-Type': 'text/plain'});
                response.write(rows);
                response.end();
            });
        } else if (command == "getAllHosts") {
            db.getAllHosts(function (rows) {
                response.writeHead(200, {'Content-Type': 'text/plain'});
                response.write(rows);
                response.end();
            });
        } else {
            console.log("[ERROR]  Unsupported API request received");
            response.writeHead(400, {'Content-Type': 'text/plain'});
            response.write("HTTP 400: Unsupported API request\n");
            response.end();
            return;
        }
    } else {
        // Read the requested interface files
        fs.readFile(HTML_PATH + pathname.substr(1), function (err, data) {
            console.log("[INFO]  File request for " + HTML_PATH + pathname.substr(1) + " received");
            if (err) {
                console.log("[ERROR]  Could not read requested file: " + err);
                response.writeHead(404, {'Content-Type': 'text/html'});
                response.write("HTTP 404: File not found");
            } else {
                response.writeHead(200, {'Content-Type': 'text/html'});
                response.write(data.toString());
            }
            response.end();
        });
    }
}).listen(PORT);

function returnError(response) {
    console.log("[ERROR]  Bad command received");
    response.writeHead(400, {'Content-Type': 'text/plain'});
    response.write("HTTP 400: Bad command received\n");
    response.end();
}

console.log("[SYS]  dyndistcc Server Version " + db.SW_VERSION + ", DB Version " + db.DB_VERSION);
console.log("[SYS]  Copyright 2016 Mark Furneaux, Romaco Canada");
console.log("[SYS]  Running on HTTP port " + PORT);
console.log("[SYS]  Ready to accept connections");