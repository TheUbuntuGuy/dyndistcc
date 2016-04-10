# dyndistcc: Use Compile Resources Better
```distcc``` is a daemon for distributing C/C++ compile jobs to other computers over a network.  
```dyndistcc``` is a simple addon system for dynamically distributing compile jobs to a pool of potentially changing clients.

# Simple Use Case
Lets say you and your team of 5 are working on a software project compiled with ```gcc```. Each developer can compile their code on their local workstation with, lets say, 4 cores. That's fine and all, but we want to go faster, and cannot afford new beast workstations.  
However with ```dyndistcc``` installed, when each developer starts a compile, the job will be compiled in parallel with all the cores of all the workstations in that team. In this example, that's ```5 workstations * 4 cores = 20 cores```; which results in a nearly **5x** speed improvement.

# How It Works
Client computers are configured as part of a 'project'. They periodically send a checkin to a server running a small node.js applet. This server application records the client and its configuration in a SQLite database and replies with a list of other clients that are part of that project that are currently online. The client will update ```distcc```'s hosts file with this new host information. As such, clients consistently have correct IP addresses and thread counts, no matter what happens on the network (DHCP, reboots, etc.). After a quick installation, no manual maintenence is required.

Multiple projects can be concurrently running on the same network, and clients within a project do not need to be the same speed or have the same number of cores. Projects can be managed via a simple web interface provided by the server.  
```dyndistcc``` enables a more effective use of total computing resources. It is unlikely that every developer will be using 100% of their workstation's compute capacity all the time, and sharing the extra resources with the team improves productivity. By running ```distcc``` with a positive nice value, the impact on other developers is minimal.

# Why Plain distcc Falls Short
```distcc``` normally requires manually configured hosts. If you have a network where IP addresses are assigned by a DHCP server, they can change and that will repeatedly break your configuration. As hosts are added and removed, every other host must be manually updated. ```distcc``` does not intrinsically know the number of threads each host is capable of, and will often assume far fewer cores than the machine truly has. ```distcc``` has support for zeroconf, however it cannot be partitioned on the same network, so if you have multiple teams, you cannot restrict the hosts that are used. ```dyndistcc``` solves all these shortcomings and enables a more effective use of total computing resources.

# Installation
Installing ```dyndistcc``` is easy. The server is a small node.js application, and the client is a self-contained, self-installing bash script.
## Server
1. Download the latest release on the Releases page.  
2. Extract the ```dyndistccserver``` folder from the .zip, place it somewhere on the server, and ```cd``` into it.
3. Run ```$ npm install .```
4. Run the server applet with ```$ nodejs dyndistccserver.js``` (append ```&``` to run it in the background)
5. Open a web browser to the server IP address/hostname on port 33333 (```http://localhost:33333``` on the server)
6. Type in a project name and click ```Create Project```

## Clients
1. Extract the ```dyndistccclient``` folder from the .zip, place it somewhere on the client, and ```cd``` into it.
2. Run ```$ sudo ./dyndistccclient.sh install``` which will automagically prep the system.
3. Follow the simple prompts for:
   1. Address/hostname of the server
   2. Project name
   3. Nice value for incoming compile jobs

If everything went according to plan, you should be able to refresh the server Control Panel page and see your new host(s) appear.
![dyndistcc Control Panel](http://furneaux.ca/dyndistcc/dyndistcc0.0.1.png "dyndistcc Control Panel")

The server will output information as clients checkin:
```
mark@volta:/media/mark/storage/Projects/dyndistcc/dyndistccserver$ nodejs dyndistccserver.js 
[SYS]  dyndistcc Server Version 0.0.1, DB Version 4
[SYS]  Copyright 2016 Mark Furneaux, Romaco Canada
[SYS]  Running on HTTP port 33333
[SYS]  Ready to accept connections
[INFO]  API request received: checkin
[INFO]  Checkin from TpfpIk5wdf2NzqXEobeWWlbkiuIbch2e
[INFO]  Distributing 18 extra threads from 3 node(s) to client TpfpIk5wdf2NzqXEobeWWlbkiuIbch2e
[INFO]  API request received: checkin
[INFO]  Checkin from My6673hNNV3W5aEMjb2yGolWlvtKTILV
[INFO]  Distributing 22 extra threads from 3 node(s) to client My6673hNNV3W5aEMjb2yGolWlvtKTILV
[INFO]  File request for html/index.html received
[INFO]  API request received: getProjectList
[INFO]  API request received: getAllHosts
[INFO]  File request for html/favicon.ico received
```

# How To Actually Compile Something
There are several ways of building with ```distcc```. The following describes *masquerading*.

1. If you are not cross-compiling skip to step 2. If you are, create symlinks in ```/usr/lib/distcc``` that point to ```/bin/distcc``` and have the name of the cross-compile tools you are using. For example, if you were using ```arm-eabi-gcc```, you should run:  
```$ ln -s /bin/distcc /usr/lib/distcc/arm-eabi-gcc```. Be sure to create links to all tools used, including assemblers.
2. *Prepend* the masquerade path to the system ```$PATH``` by running: ```$ export PATH=/usr/lib/distcc:$PATH```
3. Call ```make``` as usual, except instead of maually entering a thread count with ```-jN```, use ```distcc```'s currently available core count by running: ```$ make -j $(distcc -j)```

Step 1 is only done once, and normally you would incorporate steps 2 and 3 into a Makefile such that you don't normally need to run them.
