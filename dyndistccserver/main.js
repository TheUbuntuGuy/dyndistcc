var http = require('http');
var fs = require('fs');
var url = require('url');
var db = require('./db');

var PORT = 8080;
var HTML_PATH = "html/";
var API_PATH = "api/";

http.createServer(function (request, response) {
    var pathname = url.parse(request.url).pathname;

    //default page
    if (pathname == "/") {
        pathname = "/index.html";
    }

    if (pathname.substr(0, API_PATH.length + 1) == "/" + API_PATH) {
        console.log("API request received: %s", pathname);
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end();
    } else {
        //read the requested file
        fs.readFile(HTML_PATH + pathname.substr(1), function (err, data) {
            console.log("File request for " + HTML_PATH + pathname.substr(1) + " received.");
            if (err) {
                console.log(err);

                response.writeHead(404, {'Content-Type': 'text/html'});
            } else {

                response.writeHead(200, {'Content-Type': 'text/html'});

                response.write(data.toString());
            }
            response.end();
        });
    }
}).listen(PORT);

console.log('Server running at http://127.0.0.1:%s/', PORT);