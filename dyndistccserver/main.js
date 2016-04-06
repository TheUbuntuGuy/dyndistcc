var http = require('http');
var fs = require('fs');
var url = require('url');

var PORT = 8080;
var HTML_PATH = "html/";

http.createServer( function (request, response) {  
   var pathname = url.parse(request.url).pathname;

   console.log("Request for " + pathname + " received.");
   
   //default page
   if (pathname == "/") {
       pathname = "/index.html";
   }
   
   //read the requested file
   fs.readFile(HTML_PATH + pathname.substr(1), function (err, data) {
      if (err) {
         console.log(err);

         response.writeHead(404, {'Content-Type': 'text/html'});
      }else{	

         response.writeHead(200, {'Content-Type': 'text/html'});	
         
         response.write(data.toString());		
      }
      //send body 
      response.end();
   });   
}).listen(PORT);

console.log('Server running at http://127.0.0.1:%s/', PORT);