var http = require('http');
var fs = require('fs');
var url = require('url');
var db = require('./db');

var PORT = 33333;
var HTML_PATH = "html/";
var API_PATH = "api";

//debug
db.createProject("testproj", function () {

});

http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;
    var query = url.parse(request.url, true).query;

    //default landing page
    if (pathname == "/") {
        pathname = "/index.html";
    }

    var reqType = pathname.split("/")[1];

    if (reqType == API_PATH) {
        if (pathname.split("/").length < 3 || pathname.split("/")[2] == "") {
            console.log("Incomplete API request received");
            response.writeHead(400, {'Content-Type': 'text/plain'});
            response.write("#400: Incomplete API request\n");
            response.write("127.0.0.1");
            response.end();
            return;
        }

        var command = pathname.split("/")[2];
        console.log("API request received: %s", command);
        if (command == "checkin") {
            if (query.hash && query.project && query.username) {
                db.doCheckin(query.hash, query.project, query.username, request.connection.remoteAddress, function (hosts) {
                    console.log("Checkin from " + query.hash);
                    response.writeHead(200, {'Content-Type': 'text/plain'});
                    response.write(hosts);
                    response.end();
                });
            } else {
                console.log("Bad checkin received");
                response.writeHead(400, {'Content-Type': 'text/plain'});
                response.write("#400: Bad checkin received\n");
                response.write("127.0.0.1");
                response.end();
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
                console.log("Bad project command received");
                response.writeHead(400, {'Content-Type': 'text/plain'});
                response.write("#400: Bad project command received\n");
                response.write("127.0.0.1");
                response.end();
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
                console.log("Bad project command received");
                response.writeHead(400, {'Content-Type': 'text/plain'});
                response.write("#400: Bad project command received\n");
                response.write("127.0.0.1");
                response.end();
                return;
            }
        } else {
            console.log("Unsupported API request received");
            response.writeHead(400, {'Content-Type': 'text/plain'});
            response.write("#400: Unsupported API request\n");
            response.write("127.0.0.1");
            response.end();
            return;
        }
    } else {
        if (pathname.substr(1) == "favicon.ico") {
            response.writeHead(404, {'Content-Type': 'text/html'});
            response.write("404: File not found");
        } else {
            //read the requested interface file
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
    }
}).listen(PORT);

console.log('Server running at http://127.0.0.1:%s/', PORT);