var http = require('http');
var fs = require('fs');
var url = require('url');
var db = require('./db');

var PORT = 33333;
var HTML_PATH = "html/";
var API_PATH = "api";

http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;

    //default page
    if (pathname == "/") {
        pathname = "/index.html";
    }

    var reqType = pathname.split("/")[1];

    if (reqType == API_PATH) {
        if (pathname.split("/").length < 3 || pathname.split("/")[2] == "") {
            console.log("Incomplete API request received");
            response.writeHead(404, {'Content-Type': 'text/plain'});
            response.write("404: Incomplete API request");
            response.end();
            return;
        }
        
        var command = pathname.split("/")[2];
        console.log("API request received: %s", command);
        response.writeHead(200, {'Content-Type': 'text/plain'});

        //DEBUG
        if (command == "createProject") {
            db.createProject("testproj");
        }

        response.end();
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

console.log('Server running at http://127.0.0.1:%s/', PORT);