#!/bin/bash
#
# dyndistcc Client Install Script
# Copyright 2016 Mark Furneaux, Romaco Canada
#
# This file is part of dyndistcc.
#
# dyndistcc is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# dyndistcc is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with dyndistcc.  If not, see <http://www.gnu.org/licenses/>.

VERSION="0.0.1"
SCRIPTFILE="/usr/local/bin/dyndistccsync"
DISTCCCONF="/etc/default/distcc"
DISTCCHOSTS="/etc/distcc/hosts"

function printVersion ()
{
    echo "dyndistcc Client Version $VERSION"
    echo "Copyright 2016 Mark Furneaux, Romaco Canada"
}

function printRoot ()
{
    echo "This script must be run as root"
}

function printHelp ()
{
    scriptName=$(basename "$0")
    printVersion
    echo "Usage: $scriptName <command>"
    echo ""
    echo "Commands:"
    echo "  install         Install and configure dyndistcc client"
    echo "  uninstall       Remove dyndistcc client"
    echo "  -h or --help    Print this help and exit"
    echo "  -v              Print the script version and exit"
    echo ""
    printRoot
}

function checkRoot ()
{
    if [ $EUID -ne 0 ]; then
        printRoot
        exit 4
    fi
}

function installScript ()
{
    # Generate a random hash to identify this machine in all future checkins with the server
    clientHash=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

    # Build the checkin script with all the arguments from the installer
    echo "#!/bin/bash" >> $SCRIPTFILE
    echo "SWVERSION=\"$VERSION\"" >> $SCRIPTFILE
    echo "SERVERADDRESS=\"$serverAddr\"" >> $SCRIPTFILE
    echo "PORTNUMBER=$portNum" >> $SCRIPTFILE
    echo "PROJECTNAME=\"$projectName\"" >> $SCRIPTFILE
    echo "DISTCCHOSTS=\"$DISTCCHOSTS\"" >> $SCRIPTFILE
    echo "CLIENTHASH=\"$clientHash\"" >> $SCRIPTFILE
    echo "USERNAME=\"$userName\"" >> $SCRIPTFILE
    cat >> $SCRIPTFILE << ENDOFSCRIPT
THREADS=\$(nproc)
wget -o /dev/null -O "$DISTCCHOSTS.tmp" "http://\$SERVERADDRESS:\$PORTNUMBER/api/checkin?hash=\$CLIENTHASH&project=\$PROJECTNAME&username=\$USERNAME&swVersion=\$SWVERSION&threads=\$THREADS"
if [ $? -eq 0 ]; then
    mv "$DISTCCHOSTS.tmp" "$DISTCCHOSTS"
fi
ENDOFSCRIPT

    chmod +x $SCRIPTFILE
}

function askQuestions ()
{
    read -p "What is the hostname/IP address of the controller: " serverAddr
    if [ -z "$serverAddr" ]; then
        echo "Empty server address. Aborting installation."
        exit 2
    fi
    if [ $(getent hosts "$serverAddr" | grep "127\..*\..*\..*\ " | wc -l) -ne 0 ]; then
        echo "localhost addresses/hostnames are not supported. Use the public IP address instead. Aborting."
        exit 2
    fi
    read -p "What is the port of the controller [33333]: " portNum
    if [ -z "$portNum" ]; then
        echo "Using port 33333."
        portNum=33333
    fi
    read -p "What network segment should we listen on (CIDR notation, eg. 192.168.30.0/24): " netSegment
    if [ -z "$netSegment" ]; then
        echo "Empty segment name. Aborting installation."
        exit 2
    fi
    read -p "What project is this client part of (already configured on controller): " projectName
    if [ -z "$projectName" ]; then
        echo "Empty project name. Aborting installation."
        exit 2
    fi
    read -p "What is your name (not parsed): " userName
    if [ -z "$userName" ]; then
        echo "Empty user name. Aborting installation."
        exit 2
    fi
    read -p "The nice value for incoming jobs (-20 to 20) [10]: " niceValue
    if [ -z "$niceValue" ]; then
        echo "Using nice of 10."
        niceValue=10
    fi
}

function doInstall ()
{
    askQuestions

    if [ $(which cron | wc -l) -lt 1 ] || [ $(which wget | wc -l) -lt 1 ] || [ $(which sed | wc -l) -lt 1 ]; then
        echo "Installing dependencies..."
        apt-get install cron wget sed
        echo ""
        echo ""
    else
        echo "Dependencies already satisfied. Skipping..."
    fi

    if [ $(which distcc | wc -l) -lt 1 ]; then
        echo "distcc is missing. Installing..."
        apt-get install distcc
        echo ""
        echo ""
    else
        echo "distcc is already installed..."
    fi

    # Listener is empty to force all interfaces
    echo "Configuring distcc..."
    cp $DISTCCCONF "$DISTCCCONF.bak"
    sed -i "/^[^#]*STARTDISTCC=*/c\STARTDISTCC=\"true\"" $DISTCCCONF
    sed -i "/^[^#]*LISTENER=*/c\LISTENER=\"\"" $DISTCCCONF
    sed -i "/^[^#]*ALLOWEDNETS=*/c\ALLOWEDNETS=\"127.0.0.1 $netSegment\"" $DISTCCCONF
    sed -i "/^[^#]*NICE=*/c\NICE=\"$niceValue\"" $DISTCCCONF

    echo "Installing scripts..."
    installScript

    echo "Writing crontab..."
    CRONTMP=$(mktemp) || exit 1
    crontab -l 2>/dev/null > $CRONTMP
    if [ ! -s $CRONTMP ]; then
        echo "MAILTO=\"\"" >> $CRONTMP
    fi

    # The magic comment is used by the uninstaller
    echo "* * * * * $SCRIPTFILE #dyndistccAutoRemove" >> $CRONTMP
    crontab $CRONTMP
    rm $CRONTMP

    echo "Starting distcc..."
    service distcc restart

    if [ $? -eq 0 ]; then
        echo "Checking in with the server..."
        $SCRIPTFILE > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo "ERROR: Server returned an error or was not reachable."
        fi
        echo ""
        SUCCESSMSG="dyndistcc is now running for the $projectName project on the $netSegment network."
        if [ -e "/usr/games/cowsay" ]; then
            /usr/games/cowsay $SUCCESSMSG
        else
            echo $SUCCESSMSG
        fi
    else
        echo ""
        echo "Something went wrong when starting distcc. Things might not work correctly."
    fi

    echo ""
    cat << ENDOFTEXT
If you are cross-compiling, you will need to setup your compiler.
Create symlinks in /usr/lib/distcc that point to /bin/distcc and have the name of the cross-compile tools you are using.

For example, if you are using arm-eabi-gcc and arm-eabi-g++, run:
$ ln -s /bin/distcc /usr/lib/distcc/arm-eabi-gcc
$ ln -s /bin/distcc /usr/lib/distcc/arm-eabi-g++
ENDOFTEXT
}

function doUninstall ()
{
    echo "Uninstalling..."
    echo "Removing crontab entries..."
    crontab -l 2>/dev/null | grep --invert-match "#dyndistccAutoRemove" | crontab -
    echo "Removing scripts..."
    rm $SCRIPTFILE
    echo "Reverting distcc settings..."
    cp "$DISTCCCONF.bak" $DISTCCCONF
    echo "Stopping distcc..."
    service distcc stop
    echo ""
    echo "Uninstall complete."
}

if [ $# -ne 1 ]; then
    printHelp
else
    case $1 in
        "install")
            if [ $(crontab -l 2>/dev/null | grep "#dyndistccAutoRemove" | wc -l) -gt 0 ]; then
                echo "Error. Already installed. Please run uninstall before re-installing."
                exit 3
            fi
            checkRoot
            doInstall
            ;;
        "uninstall")
            checkRoot
            doUninstall
            ;;
        "-h")
            printHelp
            ;;
        "-v")
            printVersion
            ;;
        "--help")
            printHelp
            ;;
        *)
            echo "Invalid command: $1"
            echo ""
            printHelp
    esac
fi
